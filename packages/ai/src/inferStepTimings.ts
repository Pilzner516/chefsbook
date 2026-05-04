import { callClaude, extractJSON, HAIKU } from './client';
import { lookupCookingTiming, extractTechnique, extractIngredientCategory } from '@chefsbook/db';

export interface StepTimings {
  duration_min: number | null;
  duration_max: number | null;
  is_passive: boolean;
  uses_oven: boolean;
  oven_temp_celsius: number | null;
  phase: 'prep' | 'cook' | 'rest' | 'plate';
  timing_confidence: 'low' | 'medium' | 'high';
  technique: string | null;
  ingredient_category: string | null;
}

const INFER_STEP_TIMINGS_PROMPT = `You are extracting cooking step timing metadata. Respond ONLY with valid JSON, no explanation.

Recipe step text: "{instruction}"

Return exactly this JSON structure:
{
  "duration_min": <integer minutes or null>,
  "duration_max": <integer minutes or null>,
  "is_passive": <true if chef can walk away, false if active attention required>,
  "uses_oven": <true/false>,
  "oven_temp_celsius": <integer or null>,
  "phase": <"prep" | "cook" | "rest" | "plate">,
  "timing_confidence": <"high" if explicit time stated, "medium" if implied, "low" if vague>,
  "technique": <single lowercase word or null>,
  "ingredient_category": <one or two lowercase words or null>
}

Rules:
- duration_min/max: extract explicit times first ("bake for 30 minutes" → min:30, max:30).
  For ranges ("10-15 minutes") use both. For vague steps ("cook until done") return null.
- is_passive: simmering/baking/resting = true. Searing/stirring/folding/kneading = false.
  "Stir occasionally" = passive (occasional ≠ continuous attention).
- uses_oven: true only for steps requiring the oven. Stovetop = false.
- oven_temp_celsius: extract if stated. Convert F to C. Null if not stated.
- phase: prep = no heat, cutting/measuring/mixing. cook = heat on. rest = waiting/resting/marinating.
  plate = plating/garnishing/serving.
- timing_confidence: high = explicit minutes stated. medium = method implies typical time
  (e.g. "sear" implies 2-4 min). low = completely vague ("cook until done", "season to taste").
- technique: PRIMARY cooking technique (one word: simmer, roast, sauté, blanch, marinate, fry, bake,
  grill, steam, poach, braise, smoke, rest, reduce, deglaze, caramelize, stir-fry, render, boil,
  whisk, fold, knead, proof, chill, freeze, strain, blend, chop, slice, dice, season, mix, combine,
  coat, sear, char, flambé, cure, pickle, ferment, infuse, emulsify, temper) or null.
- ingredient_category: PRIMARY ingredient being acted on (one or two words: beef, chicken, pork,
  lamb, fish, shellfish, eggs, dairy, vegetables, onions, garlic, pasta, rice, bread, dough, sauce,
  stock, oil, spices, fruit, pastry, chocolate, sugar, flour) or null if preparation-only.`;

export async function inferStepTimings(instruction: string): Promise<StepTimings | null> {
  try {
    // STEP 1: Check cooking_action_timings knowledge graph first
    const technique = extractTechnique(instruction);
    if (technique) {
      const category = extractIngredientCategory(instruction);
      const knownTiming = await lookupCookingTiming(technique, category ?? undefined);

      // Use known timing if confidence is medium/high OR observed_count >= 3
      if (knownTiming && (
        knownTiming.confidence !== 'low' ||
        knownTiming.observed_count >= 3
      )) {
        // Prefer observed average if available
        const duration = knownTiming.observed_avg_minutes ?? knownTiming.duration_max;

        return {
          duration_min: knownTiming.duration_min,
          duration_max: duration !== null ? Math.round(duration) : knownTiming.duration_max,
          is_passive: knownTiming.is_passive,
          uses_oven: knownTiming.uses_oven,
          oven_temp_celsius: knownTiming.oven_temp_celsius,
          phase: knownTiming.phase,
          timing_confidence: knownTiming.observed_count >= 3 ? 'high' : knownTiming.confidence,
          technique: technique,
          ingredient_category: category ?? null,
        };
      }
    }

    // STEP 2: Fall back to Haiku inference if not found in knowledge graph
    const prompt = INFER_STEP_TIMINGS_PROMPT.replace('{instruction}', instruction.replace(/"/g, '\\"'));
    const text = await callClaude({ prompt, maxTokens: 200, model: HAIKU });
    return extractJSON<StepTimings>(text);
  } catch {
    return null;
  }
}
