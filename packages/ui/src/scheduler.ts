import { COURSE_ORDER } from '@chefsbook/db';
import type {
  ChefSetup,
  CookingPlan,
  ScheduledStep,
  RecipeStepWithTimings,
  OvenConflict,
  PlanWarning,
  MenuCourse,
} from './scheduler.types';

// ---------------------------------------------------------------------------
// Public input type
// ---------------------------------------------------------------------------

export interface MenuWithSteps {
  id: string;
  menu_items: Array<{
    course: MenuCourse;
    recipe: {
      id: string;
      title: string;
      recipe_steps: RecipeStepWithTimings[];
    };
  }>;
}

// ---------------------------------------------------------------------------
// Internal working representation
// ---------------------------------------------------------------------------

interface WorkingStep {
  step: RecipeStepWithTimings;
  recipe_title: string;
  recipe_id: string;
  course: MenuCourse;
  // Duration in minutes used for scheduling
  duration: number;
  // Absolute timestamps (ms since epoch), computed during scheduling
  start_ms: number;
  end_ms: number;
  chef_name: string;
  is_critical_path: boolean;
  parallel_with: string[];
}

const DEFAULT_DURATION = 5; // minutes when duration_max is null
const OVEN_PREHEAT_MINUTES = 10;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stepDuration(step: RecipeStepWithTimings): number {
  return step.duration_max ?? DEFAULT_DURATION;
}

function minutesToMs(minutes: number): number {
  return minutes * 60 * 1000;
}

function msToMinutes(ms: number): number {
  return ms / 60 / 1000;
}

// ---------------------------------------------------------------------------
// Oven conflict detection & resolution
// ---------------------------------------------------------------------------

function detectOvenConflicts(
  steps: WorkingStep[],
  ovenCount: ChefSetup['oven_count']
): { conflicts: OvenConflict[]; warnings: PlanWarning[] } {
  const ovenSteps = steps.filter((s) => s.step.uses_oven);
  const conflicts: OvenConflict[] = [];
  const warnings: PlanWarning[] = [];

  if (ovenCount === 0 && ovenSteps.length > 0) {
    warnings.push({
      type: 'oven_overloaded',
      message: 'No ovens available but steps require oven use.',
      affected_step_ids: ovenSteps.map((s) => s.step.id),
    });
    return { conflicts, warnings };
  }

  // Find pairs of oven steps that conflict (different or null temps)
  for (let i = 0; i < ovenSteps.length; i++) {
    for (let j = i + 1; j < ovenSteps.length; j++) {
      const a = ovenSteps[i]!;
      const b = ovenSteps[j]!;
      const tempA = a.step.oven_temp_celsius;
      const tempB = b.step.oven_temp_celsius;

      // Same non-null temp = shareable, no conflict
      if (tempA !== null && tempB !== null && tempA === tempB) continue;

      // Different temps or null = conflict
      if (ovenCount === 1) {
        conflicts.push({
          step_a_id: a.step.id,
          step_b_id: b.step.id,
          temp_a: tempA ?? 0,
          temp_b: tempB ?? 0,
          resolution: 'sequenced',
          adds_minutes: OVEN_PREHEAT_MINUTES,
        });
      }
      // ovenCount === 2: allow parallel, no conflict recorded
    }
  }

  return { conflicts, warnings };
}

// Apply oven sequencing: for each conflict pair, ensure step_b starts after
// step_a ends + preheat gap. Modifies start_ms/end_ms in-place.
function applyOvenSequencing(steps: WorkingStep[], conflicts: OvenConflict[]): void {
  if (conflicts.length === 0) return;

  // Build a map for quick lookup
  const byId = new Map<string, WorkingStep>();
  for (const s of steps) byId.set(s.step.id, s);

  // For each conflict, sequence b after a (a starts earlier by default because
  // we process in reverse from serve_time; we just enforce the gap)
  for (const c of conflicts) {
    const a = byId.get(c.step_a_id);
    const b = byId.get(c.step_b_id);
    if (!a || !b) continue;

    // Ensure they don't overlap: sequence the later-starting one after the earlier
    const [first, second] = a.start_ms <= b.start_ms ? [a, b] : [b, a];
    const requiredStart = first.end_ms + minutesToMs(OVEN_PREHEAT_MINUTES);
    if (second.start_ms < requiredStart) {
      const shift = requiredStart - second.start_ms;
      second.start_ms += shift;
      second.end_ms += shift;
    }
  }
}

// ---------------------------------------------------------------------------
// Chef allocation (round-robin with active-step exclusivity)
// ---------------------------------------------------------------------------

// Returns true if adding 'candidate' to a chef's current steps would cause
// two active (is_passive=false) steps to overlap.
function wouldConflictForChef(
  candidate: WorkingStep,
  chefSteps: WorkingStep[]
): boolean {
  if (candidate.step.is_passive) return false; // passive steps never block

  for (const existing of chefSteps) {
    if (existing.step.is_passive) continue; // passive steps don't block

    // Check time overlap
    const overlaps =
      candidate.start_ms < existing.end_ms &&
      candidate.end_ms > existing.start_ms;

    if (overlaps) return true;
  }
  return false;
}

function allocateChefs(steps: WorkingStep[], chefs: string[]): void {
  if (chefs.length === 0) return;

  // Track what each chef is currently assigned
  const chefAssignments = new Map<string, WorkingStep[]>();
  for (const chef of chefs) chefAssignments.set(chef, []);

  // Sort by start time ascending for allocation
  const sorted = [...steps].sort((a, b) => a.start_ms - b.start_ms);

  let robinIndex = 0;
  for (const step of sorted) {
    // Try chefs in round-robin order, skip any that have an active conflict
    let assigned = false;
    for (let attempt = 0; attempt < chefs.length; attempt++) {
      const idx = (robinIndex + attempt) % chefs.length;
      const chef = chefs[idx]!;
      const existing = chefAssignments.get(chef)!;

      if (!wouldConflictForChef(step, existing)) {
        step.chef_name = chef;
        existing.push(step);
        robinIndex = (idx + 1) % chefs.length;
        assigned = true;
        break;
      }
    }

    if (!assigned) {
      // Fallback: assign to least-loaded chef (fewest active overlapping steps)
      let bestChef = chefs[0]!;
      let bestLoad = Infinity;
      for (const chef of chefs) {
        const load = (chefAssignments.get(chef) ?? []).filter(
          (s) =>
            !s.step.is_passive &&
            s.start_ms < step.end_ms &&
            s.end_ms > step.start_ms
        ).length;
        if (load < bestLoad) {
          bestLoad = load;
          bestChef = chef;
        }
      }
      step.chef_name = bestChef;
      chefAssignments.get(bestChef)!.push(step);
      robinIndex = (chefs.indexOf(bestChef) + 1) % chefs.length;
    }
  }
}

// ---------------------------------------------------------------------------
// Critical path calculation
// ---------------------------------------------------------------------------

// A step is on the critical path if its float is zero: delaying it would push
// the serve time. We compute latest allowable start = serve_time - sum of
// durations of all dependent steps after this one. Without full dependency
// graph, we approximate: for each step, latest_start = serve_ms - duration.
// Steps whose planned_start equals their latest_start are critical.
function markCriticalPath(steps: WorkingStep[], serve_ms: number): void {
  // Group by course + phase chain: plate → cook → prep
  // A step is critical if there is no slack between its end and the next
  // phase/course boundary.

  // Simple heuristic: sort by end_ms desc, find the chain where each step's
  // end equals the next step's start (zero gap).
  const sorted = [...steps].sort((a, b) => a.end_ms - b.end_ms);

  // Mark the step(s) whose end_ms is closest to serve_ms with zero float
  for (const step of sorted) {
    // Latest start = serve_ms minus accumulated duration of all steps that
    // must come after this one. Since we don't have explicit dependencies,
    // use: latest_start = serve_ms - step.duration (each step must end by
    // serve_ms at latest if nothing depends on it)
    const latestEnd = serve_ms;
    const float = latestEnd - step.end_ms;
    step.is_critical_path = float <= 0;
  }

  // Additionally: any step whose end_ms feeds directly into the next phase
  // with zero gap is also critical
  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i]!;
    const next = sorted[i + 1]!;
    if (next.start_ms === current.end_ms) {
      current.is_critical_path = true;
    }
  }
}

// ---------------------------------------------------------------------------
// Phase ordering: plate → cook → prep (backwards from serve time)
// ---------------------------------------------------------------------------

const PHASE_ORDER = ['plate', 'cook', 'rest', 'prep'] as const;
type PhaseOrder = (typeof PHASE_ORDER)[number];

function phaseRank(phase: string): number {
  const idx = PHASE_ORDER.indexOf(phase as PhaseOrder);
  return idx === -1 ? PHASE_ORDER.length : idx;
}

// ---------------------------------------------------------------------------
// Schedule computation (working backwards from serve_time)
// ---------------------------------------------------------------------------

function scheduleStepsBackward(
  workingSteps: WorkingStep[],
  serve_ms: number,
  setup: ChefSetup
): void {
  const courseIndexMap = new Map<MenuCourse, number>();
  for (let i = 0; i < COURSE_ORDER.length; i++) {
    courseIndexMap.set(COURSE_ORDER[i]!, i);
  }

  const isPlated = setup.service_style === 'plated';

  // Group steps by course then by phase
  const byCourse = new Map<MenuCourse, WorkingStep[]>();
  for (const step of workingSteps) {
    const arr = byCourse.get(step.course) ?? [];
    arr.push(step);
    byCourse.set(step.course, arr);
  }

  // Sort courses by COURSE_ORDER descending (last course scheduled first since
  // we work backwards)
  const coursesPresent = Array.from(byCourse.keys()).sort(
    (a, b) =>
      (courseIndexMap.get(b) ?? 99) - (courseIndexMap.get(a) ?? 99)
  );

  // cursor_ms tracks earliest allowed start for next batch going backwards
  let cursor_ms = serve_ms;

  for (const course of coursesPresent) {
    const steps = byCourse.get(course)!;

    // Sort steps within course by phase rank ascending (plate first = closest
    // to serve time, so scheduled last in backwards pass)
    const byPhase = new Map<string, WorkingStep[]>();
    for (const s of steps) {
      const arr = byPhase.get(s.step.phase) ?? [];
      arr.push(s);
      byPhase.set(s.step.phase, arr);
    }

    const phases = Array.from(byPhase.keys()).sort(
      (a, b) => phaseRank(a) - phaseRank(b)
    );

    // Work backwards: plate phase is closest to serve_time
    // Assign from cursor_ms backwards
    let phase_cursor = cursor_ms;

    for (const phase of phases) {
      const phaseSteps = byPhase.get(phase)!;

      // Steps within a phase can run in parallel (up to chef constraints, handled later)
      // For timing: total duration = max of all step durations (parallel execution)
      // We assign all steps in this phase the same end time = phase_cursor
      const maxDuration = Math.max(...phaseSteps.map((s) => s.duration));
      const phaseStart = phase_cursor - minutesToMs(maxDuration);

      for (const s of phaseSteps) {
        s.end_ms = phase_cursor;
        s.start_ms = phase_cursor - minutesToMs(s.duration);
      }

      phase_cursor = phaseStart;
    }

    // In plated mode: plate steps for this course must complete before cursor_ms
    // moves forward for next (earlier) course's cook steps.
    // Since we're going backwards through courses (last course first), the
    // plate phase of this course provides the boundary for the previous course.
    if (isPlated) {
      // Find the earliest start_ms among plate steps for this course
      const plateSteps = (byPhase.get('plate') ?? []);
      if (plateSteps.length > 0) {
        const earliestPlateStart = Math.min(...plateSteps.map((s) => s.start_ms));
        // Next course's cook steps must end by this point
        cursor_ms = earliestPlateStart;
      } else {
        cursor_ms = phase_cursor;
      }
    } else {
      cursor_ms = phase_cursor;
    }
  }
}

// ---------------------------------------------------------------------------
// Parallel step detection (steps overlapping in time)
// ---------------------------------------------------------------------------

function computeParallelWith(steps: WorkingStep[]): void {
  for (const s of steps) {
    s.parallel_with = steps
      .filter(
        (other) =>
          other.step.id !== s.step.id &&
          other.start_ms < s.end_ms &&
          other.end_ms > s.start_ms
      )
      .map((other) => other.step.id);
  }
}

// ---------------------------------------------------------------------------
// Warning generation
// ---------------------------------------------------------------------------

function generateWarnings(
  steps: WorkingStep[],
  setup: ChefSetup,
  serve_ms: number
): PlanWarning[] {
  const warnings: PlanWarning[] = [];

  // No-timing-data warning
  const noTimingSteps = steps.filter(
    (s) => s.step.duration_min === null && s.step.duration_max === null
  );
  if (noTimingSteps.length > 0) {
    warnings.push({
      type: 'no_timing_data',
      message: `${noTimingSteps.length} step(s) have no timing data; using ${DEFAULT_DURATION}-minute default.`,
      affected_step_ids: noTimingSteps.map((s) => s.step.id),
    });
  }

  // Window-too-tight warning: if earliest start is in the past (relative to now)
  // We can't know "now" in a pure function, so check if total duration > available window
  if (serve_ms > 0) {
    const earliest = Math.min(...steps.map((s) => s.start_ms));
    const totalWindowMinutes = msToMinutes(serve_ms - earliest);
    const totalDurationMinutes = steps.reduce((sum, s) => {
      // Only count non-overlapping portions (approximation: sum of critical path)
      return sum + s.duration;
    }, 0);
    if (totalDurationMinutes > totalWindowMinutes * setup.chefs.length * 1.5) {
      warnings.push({
        type: 'window_too_tight',
        message: 'Total step duration may exceed available time window.',
        affected_step_ids: steps.map((s) => s.step.id),
      });
    }
  }

  return warnings;
}

// ---------------------------------------------------------------------------
// createCookingPlan
// ---------------------------------------------------------------------------

export function createCookingPlan(menu: MenuWithSteps, setup: ChefSetup): CookingPlan {
  const chefs = setup.chefs.length > 0 ? setup.chefs : ['Chef'];
  const serve_ms = setup.serve_time ? setup.serve_time.getTime() : Date.now() + minutesToMs(120);

  // 1. Flatten all steps with metadata
  const workingSteps: WorkingStep[] = [];
  for (const item of menu.menu_items) {
    for (const step of item.recipe.recipe_steps) {
      workingSteps.push({
        step,
        recipe_title: item.recipe.title,
        recipe_id: item.recipe.id,
        course: item.course,
        duration: stepDuration(step),
        start_ms: 0,
        end_ms: 0,
        chef_name: chefs[0]!,
        is_critical_path: false,
        parallel_with: [],
      });
    }
  }

  if (workingSteps.length === 0) {
    return {
      menu_id: menu.id,
      setup,
      steps: [],
      earliest_start: null,
      oven_conflicts: [],
      warnings: [],
      total_duration_minutes: 0,
    };
  }

  // 2. Schedule backwards from serve_time
  scheduleStepsBackward(workingSteps, serve_ms, setup);

  // 3. Detect oven conflicts
  const { conflicts, warnings: ovenWarnings } = detectOvenConflicts(workingSteps, setup.oven_count);

  // 4. Apply oven sequencing (only needed with 1 oven)
  if (setup.oven_count === 1) {
    applyOvenSequencing(workingSteps, conflicts);
  }

  // 5. Allocate chefs round-robin with active-step exclusivity
  allocateChefs(workingSteps, chefs);

  // 6. Compute parallel relationships
  computeParallelWith(workingSteps);

  // 7. Mark critical path
  markCriticalPath(workingSteps, serve_ms);

  // 8. Generate warnings
  const generalWarnings = generateWarnings(workingSteps, setup, serve_ms);
  const allWarnings = [...ovenWarnings, ...generalWarnings];

  // 9. Calculate plan metrics
  const earliest_ms = Math.min(...workingSteps.map((s) => s.start_ms));
  const total_duration_minutes = Math.round(msToMinutes(serve_ms - earliest_ms));

  // 10. Convert to ScheduledStep[], sorted by planned_start ASC
  const scheduledSteps: ScheduledStep[] = workingSteps
    .sort((a, b) => a.start_ms - b.start_ms)
    .map((ws) => ({
      step: ws.step,
      recipe_title: ws.recipe_title,
      recipe_id: ws.recipe_id,
      course: ws.course,
      chef_name: ws.chef_name,
      planned_start: new Date(ws.start_ms),
      planned_end: new Date(ws.end_ms),
      is_critical_path: ws.is_critical_path,
      parallel_with: ws.parallel_with,
    }));

  return {
    menu_id: menu.id,
    setup,
    steps: scheduledSteps,
    earliest_start: new Date(earliest_ms),
    oven_conflicts: conflicts,
    warnings: allWarnings,
    total_duration_minutes,
  };
}

// ---------------------------------------------------------------------------
// recomputeFromOverrun
// ---------------------------------------------------------------------------

export function recomputeFromOverrun(
  plan: CookingPlan,
  stepId: string,
  actualEndTime: Date
): CookingPlan {
  const completedIndex = plan.steps.findIndex((s) => s.step.id === stepId);
  if (completedIndex === -1) return plan;

  const completed = plan.steps[completedIndex]!;
  if (!completed.planned_end) return plan;

  const overrun_ms = actualEndTime.getTime() - completed.planned_end.getTime();
  if (overrun_ms <= 0) return plan;

  // Build mutable copy of steps
  const steps: ScheduledStep[] = plan.steps.map((s) => ({ ...s }));

  // Find all downstream steps (any step that starts at or after the completed
  // step's planned_end — i.e., depends on it temporally)
  const boundaryMs = completed.planned_end.getTime();

  const downstream = steps.filter(
    (s) =>
      s.step.id !== stepId &&
      s.planned_start !== null &&
      s.planned_start.getTime() >= boundaryMs
  );

  // Try to absorb overrun into rest steps first
  let remainingOverrun_ms = overrun_ms;

  const restSteps = downstream
    .filter((s) => s.step.phase === 'rest')
    .sort((a, b) =>
      (a.planned_start?.getTime() ?? 0) - (b.planned_start?.getTime() ?? 0)
    );

  for (const restStep of restSteps) {
    if (remainingOverrun_ms <= 0) break;
    if (!restStep.planned_start || !restStep.planned_end) continue;

    const restDuration_ms =
      restStep.planned_end.getTime() - restStep.planned_start.getTime();
    const absorbed = Math.min(remainingOverrun_ms, restDuration_ms - minutesToMs(1)); // keep at least 1 min

    if (absorbed > 0) {
      // Shrink the rest step by absorbing the overrun into it
      restStep.planned_end = new Date(restStep.planned_end.getTime() - absorbed);
      remainingOverrun_ms -= absorbed;
    }
  }

  // Cascade remaining overrun to all downstream steps
  if (remainingOverrun_ms > 0) {
    for (const s of downstream) {
      if (!s.planned_start || !s.planned_end) continue;
      s.planned_start = new Date(s.planned_start.getTime() + remainingOverrun_ms);
      s.planned_end = new Date(s.planned_end.getTime() + remainingOverrun_ms);
    }
  }

  // Update the completed step's planned_end to actualEndTime
  const updatedCompleted = steps[completedIndex]!;
  updatedCompleted.planned_end = actualEndTime;

  // Recalculate earliest_start
  const validStarts = steps
    .map((s) => s.planned_start?.getTime())
    .filter((t): t is number => t !== undefined && t !== null);
  const earliest_start =
    validStarts.length > 0 ? new Date(Math.min(...validStarts)) : plan.earliest_start;

  return {
    ...plan,
    steps,
    earliest_start,
  };
}

// ---------------------------------------------------------------------------
// buildStepCallout
// ---------------------------------------------------------------------------

// Extract a brief imperative from a step instruction (first ~50 chars, trimmed
// to a verb phrase ending before a comma or period where possible)
function briefInstruction(instruction: string): string {
  const trimmed = instruction.trim();
  // Try to cut at first comma or period within reasonable length
  const cutAt = trimmed.search(/[,\.]/);
  if (cutAt > 10 && cutAt <= 60) {
    return trimmed.slice(0, cutAt).trim().toLowerCase();
  }
  // Otherwise take up to 55 chars, cut at last space
  const maxLen = 55;
  if (trimmed.length <= maxLen) return trimmed.toLowerCase();
  const sliced = trimmed.slice(0, maxLen);
  const lastSpace = sliced.lastIndexOf(' ');
  return (lastSpace > 10 ? sliced.slice(0, lastSpace) : sliced).toLowerCase();
}

function attentionHint(step: RecipeStepWithTimings): string {
  return step.is_passive
    ? 'passive — keep going with the sauce'
    : 'stay close';
}

function formatCalloutDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

export function buildStepCallout(step: ScheduledStep, chefName: string): string {
  const brief = briefInstruction(step.step.instruction);
  const confidence = step.step.timing_confidence;
  const duration = step.step.duration_max;

  const hasReliableTiming =
    duration !== null &&
    (confidence === 'high' || confidence === 'medium');

  if (!hasReliableTiming) {
    return `${chefName}: ${brief}. Take your time.`;
  }

  const durationStr = formatCalloutDuration(duration);
  const hint = attentionHint(step.step);
  return `${chefName}: ${brief}. About ${durationStr}, ${hint}.`;
}
