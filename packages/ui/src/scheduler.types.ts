import { MenuCourse, COURSE_ORDER } from '@chefsbook/db';

export type StepPhase = 'prep' | 'cook' | 'rest' | 'plate';
export type TimingConfidence = 'low' | 'medium' | 'high';
export type ServiceStyle = 'plated' | 'buffet';

export interface RecipeStepWithTimings {
  id: string;
  recipe_id: string;
  step_number: number;
  instruction: string;
  duration_min: number | null;
  duration_max: number | null;
  is_passive: boolean;
  uses_oven: boolean;
  oven_temp_celsius: number | null;
  phase: StepPhase;
  timing_confidence: TimingConfidence;
  technique?: string | null;
  ingredient_category?: string | null;
}

export interface ChefSetup {
  chefs: string[];
  oven_count: 1 | 2 | 0;
  service_style: ServiceStyle;
  chefs_eating_at_table: boolean;
  serve_time: Date | null;
}

export interface ScheduledStep {
  step: RecipeStepWithTimings;
  recipe_title: string;
  recipe_id: string;
  course: MenuCourse;
  chef_name: string;
  planned_start: Date | null;
  planned_end: Date | null;
  is_critical_path: boolean;
  parallel_with: string[];
}

export interface OvenConflict {
  step_a_id: string;
  step_b_id: string;
  temp_a: number;
  temp_b: number;
  resolution: 'sequenced';
  adds_minutes: number;
}

export interface PlanWarning {
  type: 'window_too_tight' | 'no_timing_data' | 'oven_overloaded';
  message: string;
  affected_step_ids: string[];
}

export interface CookingPlan {
  menu_id: string;
  setup: ChefSetup;
  steps: ScheduledStep[];
  earliest_start: Date | null;
  oven_conflicts: OvenConflict[];
  warnings: PlanWarning[];
  total_duration_minutes: number;
}

export interface StepActual {
  step_id: string;
  actual_start: string;
  actual_end: string | null;
  overrun_minutes: number;
}

export interface CookingSession {
  id: string;
  menu_id: string;
  user_id: string;
  setup: ChefSetup;
  plan: CookingPlan;
  status: 'briefing' | 'prep' | 'cooking' | 'complete';
  current_step_index: number;
  step_actuals: StepActual[];
  version: number;
  started_at: string;
  completed_at: string | null;
}

export type { MenuCourse };
export { COURSE_ORDER };
