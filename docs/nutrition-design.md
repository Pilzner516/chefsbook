# Nutrition Feature — Design Document

**Author:** Claude (Architecture Session)  
**Date:** 2026-04-24  
**Status:** Ready for Implementation

---

## 1. Database Schema

### Current State

The `recipes` table already has four nutrition columns:
```sql
calories     numeric(8,2)
protein_g    numeric(8,2)
carbs_g      numeric(8,2)
fat_g        numeric(8,2)
```

These are currently unused (all NULL).

### Decision: JSONB vs Additional Columns

**Recommendation: Use JSONB for nutrition data.**

Reasons:
1. Future extensibility — easy to add micronutrients (vitamins, minerals) without migrations
2. Per-serving vs per-100g can be stored together in one structure
3. Confidence score and estimation metadata fit naturally
4. Avoids wide table sprawl (recipes already has 65+ columns)
5. GIN index on JSONB enables efficient range queries

### Migration SQL

```sql
-- Migration: 060_add_nutrition_data.sql
-- Add JSONB nutrition column with complete nutritional data

ALTER TABLE recipes ADD COLUMN nutrition JSONB;
ALTER TABLE recipes ADD COLUMN nutrition_generated_at TIMESTAMPTZ;
ALTER TABLE recipes ADD COLUMN nutrition_source TEXT CHECK (nutrition_source IN ('ai', 'manual', 'imported'));

-- Index for JSONB queries (supports range filters)
CREATE INDEX idx_recipes_nutrition ON recipes USING GIN (nutrition jsonb_path_ops);

-- Index for calorie range queries specifically (common filter)
CREATE INDEX idx_recipes_nutrition_calories ON recipes (((nutrition->>'calories_per_serving')::numeric))
  WHERE nutrition IS NOT NULL;

-- Comment for schema documentation
COMMENT ON COLUMN recipes.nutrition IS 
'AI-estimated or manually entered nutrition data. Structure:
{
  "per_serving": {
    "calories": number,
    "protein_g": number,
    "carbs_g": number,
    "fat_g": number,
    "fiber_g": number,
    "sugar_g": number,
    "sodium_mg": number
  },
  "per_100g": { ...same fields... } | null,
  "total_weight_g": number | null,
  "confidence": number (0.0-1.0),
  "notes": string | null
}';
```

### JSONB Structure

```typescript
interface RecipeNutrition {
  per_serving: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g: number;
    sugar_g: number;
    sodium_mg: number;
  };
  per_100g: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g: number;
    sugar_g: number;
    sodium_mg: number;
  } | null;
  total_weight_g: number | null;
  confidence: number; // 0.0-1.0
  notes: string | null; // e.g., "Sodium estimate may vary based on salt type"
}
```

### NULL Handling

- `nutrition IS NULL` → recipe has no nutrition data yet
- `per_100g IS NULL` within the JSONB → weight couldn't be estimated (soups, sauces, drinks)
- UI hides per-100g toggle when `per_100g` is null

---

## 2. AI Function Design

### Function Signature

```typescript
// packages/ai/src/generateNutrition.ts

export interface NutritionEstimate {
  per_serving: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g: number;
    sugar_g: number;
    sodium_mg: number;
  };
  per_100g: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g: number;
    sugar_g: number;
    sodium_mg: number;
  } | null;
  total_weight_g: number | null;
  confidence: number;
  notes: string | null;
}

export interface NutritionInput {
  title: string;
  servings: number | null;
  ingredients: Array<{
    quantity: number | null;
    unit: string | null;
    ingredient: string;
  }>;
}

export async function generateNutrition(input: NutritionInput): Promise<NutritionEstimate>;
```

### Claude Prompt (Full)

```typescript
const NUTRITION_PROMPT = `You are a professional nutritionist AI assistant. Estimate the nutritional content of this recipe based on the ingredient list.

RECIPE:
Title: {{title}}
Servings: {{servings}}

INGREDIENTS:
{{ingredients}}

TASK:
1. Estimate the nutritional values PER SERVING based on standard USDA nutritional data.
2. Estimate the total weight of one serving in grams.
3. If you can confidently estimate total serving weight, calculate the per-100g values.
4. Assign a confidence score (0.0-1.0) based on how precise your estimates can be.

CONFIDENCE GUIDELINES:
- 0.9-1.0: All ingredients have precise quantities, standard items (chicken breast, rice, etc.)
- 0.7-0.9: Most quantities present, some estimation needed for prep methods
- 0.5-0.7: Several "to taste" ingredients, variable portion sizes
- 0.3-0.5: Many missing quantities, complex preparations
- Below 0.3: Too uncertain to estimate reliably

RULES:
- Use USDA nutritional database values as your reference
- Account for cooking method effects (oil absorption, water loss)
- For "to taste" items (salt, pepper), use typical home cooking amounts
- If servings is null or 0, assume 4 servings
- If total weight cannot be estimated (soups, sauces, drinks, variable-yield items), set per_100g and total_weight_g to null
- Round all values to 1 decimal place
- Never invent ingredients not listed
- For alcoholic recipes, note that alcohol calories may vary based on cooking method

Return ONLY a JSON object with no markdown or explanation:
{
  "per_serving": {
    "calories": number,
    "protein_g": number,
    "carbs_g": number,
    "fat_g": number,
    "fiber_g": number,
    "sugar_g": number,
    "sodium_mg": number
  },
  "per_100g": { same fields } | null,
  "total_weight_g": number | null,
  "confidence": number,
  "notes": "string explaining any assumptions or limitations" | null
}`;
```

### maxTokens Recommendation

**Recommended: 800 tokens**

Justification:
- Output is a fixed-structure JSON object (~200-300 tokens)
- No variable-length arrays like ingredients or steps
- 800 provides safety margin for notes field
- Compare to: `scanRecipe` uses 3000, `importFromUrl` uses 6000 (both have variable-length arrays)

### Model Selection

**Recommendation: claude-haiku-4-5**

Justification:
1. Task is structured estimation, not creative generation
2. USDA nutritional data is well-represented in training data
3. Output format is simple fixed JSON
4. Per ai-cost.md, Haiku is appropriate for "simple classification/moderation tasks"
5. Cost: ~$0.0003 per recipe vs ~$0.003 for Sonnet (10x cheaper)
6. Volume consideration: runs on every import, cost sensitivity is high

If quality is insufficient in testing, upgrade to Sonnet for the first implementation prompt.

### Error Handling

```typescript
export async function generateNutrition(input: NutritionInput): Promise<NutritionEstimate | null> {
  // Validation: need at least 1 ingredient to estimate
  if (!input.ingredients || input.ingredients.length === 0) {
    return null;
  }

  try {
    const prompt = buildNutritionPrompt(input);
    const text = await callClaude({ prompt, maxTokens: 800, model: HAIKU });
    const result = extractJSON<NutritionEstimate>(text);
    
    // Validate required fields exist
    if (!result.per_serving || typeof result.per_serving.calories !== 'number') {
      console.warn('[generateNutrition] Invalid response structure');
      return null;
    }
    
    // Clamp confidence to valid range
    result.confidence = Math.max(0, Math.min(1, result.confidence));
    
    return result;
  } catch (error) {
    // ClaudeJsonParseError, ClaudeTruncatedError, or network errors
    console.warn('[generateNutrition] Failed:', error);
    return null;
  }
}
```

---

## 3. Import Pipeline Integration

### Import Path Matrix

| Import Path | Location | Nutrition Timing | Rationale |
|-------------|----------|------------------|-----------|
| URL import | `/api/import/url` | Fire-and-forget after save | Non-blocking; user sees recipe immediately |
| Bookmark batch | `/dashboard/scan` batch loop | Skip (too many calls) | Cost concern; generate on-demand |
| Extension import | `/api/extension/import` | Fire-and-forget after save | Same as URL import |
| Photo scan | `scanRecipeMultiPage()` | Fire-and-forget after save | After ingredients are confirmed |
| Speak a Recipe | `/api/speak` | Fire-and-forget after save | After recipe is structured |
| YouTube import | `/api/import/youtube` | Fire-and-forget after save | After transcript extraction |
| Cookbook TOC import | `/api/cookbooks/import-recipe` | Fire-and-forget after save | After recipe is created |
| Manual entry | Client-side on save | Skip (user is editing) | Generate only when user clicks button |
| Re-import | `/api/import/reimport` | Re-generate | Ingredients may have changed |

### Implementation Pattern

Add to `/api/recipes/finalize` route (already called by all import paths except manual entry):

```typescript
// After completeness check passes
if (completeness.isComplete) {
  // Fire-and-forget nutrition generation
  generateAndSaveNutrition(recipeId, recipe.title, recipe.servings, recipe.ingredients)
    .catch((err) => console.warn('[finalize] Nutrition generation failed:', err));
}
```

### Cost Analysis Per Import Path

Per ai-cost.md, Haiku at ~$0.0003 per call:

| Path | Frequency | Cost Impact |
|------|-----------|-------------|
| URL import | High | +$0.0003/import |
| Extension | Medium | +$0.0003/import |
| Scan | Medium | +$0.0003/import |
| Speak | Low | +$0.0003/recipe |
| YouTube | Low | +$0.0003/import |
| Cookbook | Low | +$0.0003/recipe |
| Batch import | Skip | $0 (on-demand only) |

### Recommendation for Batch Import

Do NOT generate nutrition during batch import. Instead:
1. Show a banner after batch import: "Generate nutrition data for your imported recipes?"
2. Clicking runs a background job that processes recipes one at a time with rate limiting
3. This avoids hitting Anthropic rate limits during large imports (200+ recipes)

---

## 4. Recipe Detail UI

### Card Placement

Insert the nutrition card **after the Steps section and before Cooking Notes**:

```
┌─────────────────────────────────────────┐
│ Hero Image                              │
│ Title, Attribution, Like/Save           │
│ Description                             │
│ Ingredients (with serving scaler)       │
│ Steps                                   │
│ ─────────────────────────────────────── │
│ 🥗 NUTRITION CARD ← NEW                 │
│ ─────────────────────────────────────── │
│ 📝 Cooking Notes (owner only)           │
│ 💬 Comments                             │
└─────────────────────────────────────────┘
```

Line reference in `apps/web/app/recipe/[id]/page.tsx`: Insert before the `{/* Cooking Notes (owner only) */}` section at line ~2381.

### Component Structure

```typescript
// apps/web/components/NutritionCard.tsx

interface NutritionCardProps {
  nutrition: RecipeNutrition | null;
  servings: number;
  isOwner: boolean;
  recipeId: string;
  onRegenerate?: () => Promise<void>;
  loading?: boolean;
}

export function NutritionCard({
  nutrition,
  servings,
  isOwner,
  recipeId,
  onRegenerate,
  loading,
}: NutritionCardProps) {
  const [view, setView] = useState<'serving' | '100g'>('serving');
  
  // Persist toggle preference
  useEffect(() => {
    const saved = localStorage.getItem('nutrition-view');
    if (saved === '100g' && nutrition?.per_100g) setView('100g');
  }, [nutrition]);
  
  const handleToggle = (newView: 'serving' | '100g') => {
    setView(newView);
    localStorage.setItem('nutrition-view', newView);
  };
  
  // ... render logic
}
```

### Data Shape for Props

```typescript
interface NutritionDisplayData {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
}
```

### Toggle Implementation

```tsx
{nutrition?.per_100g && (
  <div className="flex gap-1 bg-cb-bg rounded-full p-0.5">
    <button
      onClick={() => handleToggle('serving')}
      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
        view === 'serving' 
          ? 'bg-cb-primary text-white' 
          : 'text-cb-secondary hover:text-cb-text'
      }`}
    >
      Per Serving
    </button>
    <button
      onClick={() => handleToggle('100g')}
      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
        view === '100g' 
          ? 'bg-cb-primary text-white' 
          : 'text-cb-secondary hover:text-cb-text'
      }`}
    >
      Per 100g
    </button>
  </div>
)}
```

### Loading State (Skeleton)

```tsx
{loading && (
  <div className="bg-cb-card border border-cb-border rounded-card p-4 animate-pulse">
    <div className="h-4 w-32 bg-cb-bg rounded mb-3" />
    <div className="grid grid-cols-4 gap-3">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="h-12 bg-cb-bg rounded" />
      ))}
    </div>
  </div>
)}
```

### Empty State

```tsx
{!nutrition && !loading && (
  <div className="bg-cb-card border border-cb-border rounded-card p-4">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-cb-secondary">
        <span className="text-lg">🥗</span>
        <span className="text-sm">Nutrition data not yet generated</span>
      </div>
      {isOwner && (
        <button
          onClick={onGenerate}
          className="flex items-center gap-1.5 bg-cb-primary text-white px-3 py-1.5 rounded-full text-xs font-medium hover:bg-cb-primary/90 transition"
        >
          <span>✨</span> Generate Nutrition
        </button>
      )}
    </div>
  </div>
)}
```

### Generate/Regenerate Button

- **Generate button**: Visible when `nutrition IS NULL` and `isOwner`
- **Regenerate pill**: Small "↻" icon button visible when `nutrition IS NOT NULL` and `isOwner`
- Both buttons call `/api/recipes/[id]/generate-nutrition`

### Trattoria Design Compliance

| Element | Token | Value |
|---------|-------|-------|
| Card background | `bg-cb-card` | `#ffffff` |
| Card border | `border-cb-border` | `#e8e0d0` |
| Card radius | `rounded-card` | 12px |
| Section header | `text-cb-text` | `#1a1a1a` |
| Nutrient labels | `text-cb-secondary` | `#7a6a5a` |
| Nutrient values | `text-cb-text font-semibold` | `#1a1a1a` |
| Toggle active | `bg-cb-primary text-white` | `#ce2b37` |
| Toggle inactive | `bg-cb-bg text-cb-secondary` | `#faf7f0` |
| Generate button | `bg-cb-primary` | `#ce2b37` |

### Mobile Layout

The card must work in React Native for `apps/mobile/app/recipe/[id].tsx`:

```tsx
// apps/mobile/components/NutritionCard.tsx

export function NutritionCard({ nutrition, servings, isOwner }: Props) {
  const { colors } = useTheme();
  const [view, setView] = useState<'serving' | '100g'>('serving');
  
  // 2-column grid for nutrients
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Nutrition</Text>
        {nutrition?.per_100g && (
          <SegmentedControl
            values={['Per Serving', 'Per 100g']}
            selectedIndex={view === 'serving' ? 0 : 1}
            onChange={(index) => setView(index === 0 ? 'serving' : '100g')}
          />
        )}
      </View>
      <View style={styles.grid}>
        <NutrientRow label="Calories" value={data.calories} unit="" />
        <NutrientRow label="Protein" value={data.protein_g} unit="g" />
        <NutrientRow label="Carbs" value={data.carbs_g} unit="g" />
        <NutrientRow label="Fat" value={data.fat_g} unit="g" />
        <NutrientRow label="Fiber" value={data.fiber_g} unit="g" />
        <NutrientRow label="Sugar" value={data.sugar_g} unit="g" />
        <NutrientRow label="Sodium" value={data.sodium_mg} unit="mg" />
      </View>
      <Text style={[styles.disclaimer, { color: colors.muted }]}>
        Estimated by Sous Chef. Not a substitute for professional dietary advice.
      </Text>
    </View>
  );
}
```

---

## 5. Search Filter Integration

### Filter Options

Add a new **Nutrition** section to the left filter panel:

```
NUTRITION
─────────────────
Calories
  ○ Any
  ○ Under 300
  ○ 300-500
  ○ 500-700
  ○ Over 700

Protein
  ○ Any
  ○ High Protein (>25g)
  ○ Moderate (10-25g)
  ○ Low (<10g)

Dietary Presets
  □ Low Carb (<20g)
  □ High Protein (>30g)
  □ Low Fat (<10g)
  □ High Fiber (>8g)
  □ Low Sodium (<500mg)
```

### State Management

```typescript
// In SearchPage component
const [calorieRange, setCalorieRange] = useState<'any' | 'under300' | '300-500' | '500-700' | 'over700'>('any');
const [proteinLevel, setProteinLevel] = useState<'any' | 'high' | 'moderate' | 'low'>('any');
const [nutritionPresets, setNutritionPresets] = useState<string[]>([]);
```

### JSONB Query SQL

```sql
-- Search recipes with nutrition filters
SELECT * FROM recipes
WHERE 
  visibility IN ('public', 'shared_link')
  -- Calorie range filter
  AND (
    :calorie_range = 'any'
    OR (:calorie_range = 'under300' AND (nutrition->>'per_serving'->>'calories')::numeric < 300)
    OR (:calorie_range = '300-500' AND (nutrition->'per_serving'->>'calories')::numeric BETWEEN 300 AND 500)
    OR (:calorie_range = '500-700' AND (nutrition->'per_serving'->>'calories')::numeric BETWEEN 500 AND 700)
    OR (:calorie_range = 'over700' AND (nutrition->'per_serving'->>'calories')::numeric > 700)
  )
  -- Protein level filter
  AND (
    :protein_level = 'any'
    OR (:protein_level = 'high' AND (nutrition->'per_serving'->>'protein_g')::numeric > 25)
    OR (:protein_level = 'moderate' AND (nutrition->'per_serving'->>'protein_g')::numeric BETWEEN 10 AND 25)
    OR (:protein_level = 'low' AND (nutrition->'per_serving'->>'protein_g')::numeric < 10)
  )
  -- Dietary presets (array check)
  AND (
    'low_carb' = ANY(:presets) IS FALSE OR (nutrition->'per_serving'->>'carbs_g')::numeric < 20
  )
  AND (
    'high_protein' = ANY(:presets) IS FALSE OR (nutrition->'per_serving'->>'protein_g')::numeric > 30
  )
  -- ... additional preset filters
ORDER BY created_at DESC
LIMIT 100;
```

### RPC Function Update

Extend the existing `search_recipes` RPC or create a new wrapper:

```sql
-- Option A: Add parameters to search_recipes
CREATE OR REPLACE FUNCTION search_recipes(
  -- ... existing params ...
  p_calorie_max INTEGER DEFAULT NULL,
  p_calorie_min INTEGER DEFAULT NULL,
  p_protein_min INTEGER DEFAULT NULL,
  p_carbs_max INTEGER DEFAULT NULL,
  p_sodium_max INTEGER DEFAULT NULL
) RETURNS SETOF recipes AS $$
BEGIN
  RETURN QUERY
  SELECT r.* FROM recipes r
  WHERE
    -- ... existing filters ...
    AND (p_calorie_max IS NULL OR (r.nutrition->'per_serving'->>'calories')::numeric <= p_calorie_max)
    AND (p_calorie_min IS NULL OR (r.nutrition->'per_serving'->>'calories')::numeric >= p_calorie_min)
    AND (p_protein_min IS NULL OR (r.nutrition->'per_serving'->>'protein_g')::numeric >= p_protein_min)
    AND (p_carbs_max IS NULL OR (r.nutrition->'per_serving'->>'carbs_g')::numeric <= p_carbs_max)
    AND (p_sodium_max IS NULL OR (r.nutrition->'per_serving'->>'sodium_mg')::numeric <= p_sodium_max);
END;
$$ LANGUAGE plpgsql;
```

### UI Placement

Add the Nutrition section in `apps/web/app/dashboard/search/page.tsx` after the existing "Dietary" section (around line 326):

```tsx
{/* Nutrition Filters */}
<div>
  <h3 className="text-xs font-bold text-cb-secondary uppercase tracking-wide mb-2">Nutrition</h3>
  
  {/* Calorie Range */}
  <div className="mb-3">
    <p className="text-xs text-cb-muted mb-1">Calories per serving</p>
    <div className="space-y-0.5">
      {CALORIE_RANGES.map((range) => (
        <button
          key={range.value}
          onClick={() => setCalorieRange(range.value)}
          className={`block text-sm w-full text-left px-2 py-1 rounded ${
            calorieRange === range.value
              ? 'bg-cb-primary/10 text-cb-primary font-medium'
              : 'text-cb-secondary hover:text-cb-text'
          }`}
        >
          {range.label}
        </button>
      ))}
    </div>
  </div>
  
  {/* Dietary Presets */}
  <div>
    <p className="text-xs text-cb-muted mb-1">Dietary goals</p>
    <div className="flex flex-wrap gap-1">
      {NUTRITION_PRESETS.map((preset) => (
        <button
          key={preset.key}
          onClick={() => toggleNutritionPreset(preset.key)}
          className={`text-xs px-2 py-1 rounded-full ${
            nutritionPresets.includes(preset.key)
              ? 'bg-cb-primary text-white'
              : 'bg-cb-bg text-cb-secondary hover:text-cb-text'
          }`}
        >
          {preset.label}
        </button>
      ))}
    </div>
  </div>
</div>
```

---

## 6. Meal Plan Integration

### New Inputs for Meal Plan UI

Add an optional "Nutrition Goals" step to the MealPlanWizard:

```typescript
// Extend MealPlanPreferences
export interface MealPlanPreferences {
  // ... existing fields ...
  nutritionGoals?: {
    dailyCalories?: number;
    macroSplit?: 'balanced' | 'low_carb' | 'high_protein' | 'keto';
    proteinTarget?: number; // grams
  };
}
```

### Wizard Step UI

Add as Step 3 (optional, skippable) in `apps/web/components/MealPlanWizard.tsx`:

```tsx
{/* Step 3: Nutrition Goals (Optional) */}
{step === 3 && (
  <div className="space-y-4">
    <h3 className="text-lg font-semibold">Nutrition Goals (Optional)</h3>
    <p className="text-sm text-cb-secondary">
      Set daily targets to help balance your meal plan.
    </p>
    
    <div>
      <label className="text-sm font-medium">Daily Calorie Target</label>
      <input
        type="number"
        value={preferences.nutritionGoals?.dailyCalories ?? ''}
        onChange={(e) => setNutritionGoal('dailyCalories', parseInt(e.target.value) || undefined)}
        placeholder="e.g., 2000"
        className="w-full border border-cb-border rounded-input px-3 py-2 mt-1"
      />
    </div>
    
    <div>
      <label className="text-sm font-medium">Macro Preference</label>
      <div className="grid grid-cols-2 gap-2 mt-1">
        {MACRO_PRESETS.map((preset) => (
          <button
            key={preset.key}
            onClick={() => setNutritionGoal('macroSplit', preset.key)}
            className={`p-3 rounded-card border ${
              preferences.nutritionGoals?.macroSplit === preset.key
                ? 'border-cb-primary bg-cb-primary/5'
                : 'border-cb-border'
            }`}
          >
            <span className="block font-medium">{preset.label}</span>
            <span className="text-xs text-cb-secondary">{preset.description}</span>
          </button>
        ))}
      </div>
    </div>
    
    <button
      onClick={() => setStep(4)}
      className="text-sm text-cb-secondary hover:text-cb-text"
    >
      Skip this step →
    </button>
  </div>
)}
```

### generateMealPlan Prompt Changes

Add nutrition context to the existing prompt in `packages/ai/src/mealPlanWizard.ts`:

```typescript
const nutritionContext = preferences.nutritionGoals ? `
Nutrition Goals:
- Daily calorie target: ${preferences.nutritionGoals.dailyCalories ?? 'not specified'}
- Macro preference: ${preferences.nutritionGoals.macroSplit ?? 'balanced'}
- Protein target: ${preferences.nutritionGoals.proteinTarget ?? 'not specified'}g

When selecting recipes, prioritize those that help meet these daily nutrition targets.
Balance calories across meals (larger for dinner, lighter for breakfast).
` : '';

const prompt = `Generate a meal plan for these preferences:

Days: ${preferences.days.join(', ')}
...existing content...
${nutritionContext}

Rules:
...existing rules...
8. If nutrition goals are set, distribute calories appropriately across meals
9. Include an estimated daily nutrition summary for each day

Return ONLY a JSON array with this structure:
[{
  "day": "monday",
  "slot": "dinner",
  "recipe_id": "uuid-or-null",
  "title": "Recipe Name",
  "source": "my_recipe" | "ai_suggestion",
  "cuisine": "Italian",
  "estimated_time": 30,
  "reason": "Brief explanation",
  "estimated_calories": number | null
}]

After the array, include a daily_summaries object:
{
  "daily_summaries": {
    "monday": { "calories": 1850, "protein_g": 95, "carbs_g": 180, "fat_g": 75 },
    ...
  }
}`;
```

### Daily Nutrition Summary Display

Add a summary row at the bottom of each day in the meal plan view:

```tsx
{/* Daily Nutrition Summary */}
{dailySummary && (
  <div className="mt-2 pt-2 border-t border-cb-border flex gap-4 text-xs text-cb-secondary">
    <span>📊 Daily Total:</span>
    <span>{dailySummary.calories} cal</span>
    <span>{dailySummary.protein_g}g protein</span>
    <span>{dailySummary.carbs_g}g carbs</span>
    <span>{dailySummary.fat_g}g fat</span>
  </div>
)}
```

### Nutrition Targets vs Recipe Selection

**Recommendation: Labeling only, not selection.**

Nutrition targets should influence the *labeling* of the plan output (showing daily totals, flagging if over/under targets) but NOT the recipe selection algorithm itself. Reasons:

1. Most user recipes don't have nutrition data yet
2. Limiting selection to recipes with nutrition data would severely reduce variety
3. AI suggestions can estimate nutrition on-the-fly
4. Better UX: show the plan, let user swap recipes if nutrition doesn't fit

---

## 7. Implementation Order

### Phase 1: Foundation (Can ship independently)

| Step | Task | Dependencies | Can Parallelize |
|------|------|--------------|-----------------|
| 1.1 | Write and apply migration | None | — |
| 1.2 | Add `generateNutrition()` to @chefsbook/ai | None | Yes with 1.1 |
| 1.3 | Add `/api/recipes/[id]/generate-nutrition` route | 1.1, 1.2 | — |
| 1.4 | Build `NutritionCard.tsx` component (web) | 1.1 | Yes with 1.2-1.3 |
| 1.5 | Mount NutritionCard in recipe detail page | 1.3, 1.4 | — |

**Ship after 1.5:** Users can manually generate nutrition for any recipe.

### Phase 2: Auto-generation

| Step | Task | Dependencies |
|------|------|--------------|
| 2.1 | Wire generateNutrition into `/api/recipes/finalize` | Phase 1 |
| 2.2 | Add nutrition to Recipe type in @chefsbook/db | 1.1 |
| 2.3 | Test all import paths generate nutrition | 2.1 |

**Ship after 2.3:** All new imports auto-generate nutrition.

### Phase 3: Search Filters

| Step | Task | Dependencies |
|------|------|--------------|
| 3.1 | Update `search_recipes` RPC with nutrition params | 1.1 |
| 3.2 | Add nutrition filter UI to search page | 3.1 |
| 3.3 | Wire filter state to API calls | 3.2 |

**Ship after 3.3:** Users can filter by nutrition.

### Phase 4: Meal Plan Integration

| Step | Task | Dependencies |
|------|------|--------------|
| 4.1 | Add nutrition goals step to MealPlanWizard | Phase 1 |
| 4.2 | Update generateMealPlan prompt | 4.1 |
| 4.3 | Add daily summary display to meal plan view | 4.2 |

### Phase 5: Mobile Parity

| Step | Task | Dependencies |
|------|------|--------------|
| 5.1 | Build NutritionCard.tsx for mobile | Phase 1 |
| 5.2 | Mount in mobile recipe detail | 5.1 |
| 5.3 | Add nutrition filters to mobile search | Phase 3 |

### Phase 6: Backfill Existing Recipes

| Step | Task | Dependencies |
|------|------|--------------|
| 6.1 | Build admin bulk generation script | Phase 1 |
| 6.2 | Add "Generate Nutrition" banner for users | Phase 1 |

---

## 8. Prompt Split Recommendation

### Nutrition-1: Foundation (Sonnet)

**Scope:**
- Migration 060
- `packages/ai/src/generateNutrition.ts`
- `/api/recipes/[id]/generate-nutrition` route
- `NutritionCard.tsx` component (web only)
- Mount card in recipe detail page
- Manual generate/regenerate functionality

**Estimated session length:** 1 session

### Nutrition-2: Auto-generation (Sonnet)

**Scope:**
- Wire into `/api/recipes/finalize`
- Test all import paths
- Add to @chefsbook/db types
- Update DONE.md

**Estimated session length:** 1 session

### Nutrition-3: Search Filters (Sonnet)

**Scope:**
- Update `search_recipes` RPC
- Add filter UI to web search page
- Wire filter state to API

**Estimated session length:** 1 session

### Nutrition-4: Meal Plan (Sonnet)

**Scope:**
- Add nutrition goals to MealPlanWizard
- Update generateMealPlan prompt
- Add daily summary display

**Estimated session length:** 1 session

### Nutrition-5: Mobile Parity (Sonnet)

**Scope:**
- NutritionCard.tsx for React Native
- Mount in mobile recipe detail
- Mobile search filters (if time permits)

**Estimated session length:** 1-2 sessions

### Nutrition-6: Backfill (Sonnet)

**Scope:**
- Admin bulk generation script
- User-facing "generate for all" feature
- Rate limiting and progress tracking

**Estimated session length:** 1 session

---

## 9. Cost Analysis

### Per-Call Cost

Using claude-haiku-4-5 per ai-cost.md:
- Input: ~400 tokens (prompt + ingredients)
- Output: ~200 tokens (JSON response)
- Cost: (400 × $0.80/1M) + (200 × $4.00/1M) = $0.00032 + $0.0008 = **~$0.0011 per recipe**

Correction based on ai-cost.md pricing table:
- Haiku: $0.80/1M input, $4.00/1M output
- Per call: ~$0.001 ($0.0003 input + $0.0008 output)

### Monthly Cost Impact

Assumptions from prompt:
- Average user imports 5 new recipes/month
- Current active users: ~100 (estimate)

| Scenario | Monthly Calls | Monthly Cost |
|----------|---------------|--------------|
| 100 users × 5 imports | 500 | $0.50 |
| 500 users × 5 imports | 2,500 | $2.50 |
| 1,000 users × 5 imports | 5,000 | $5.00 |

### Comparison to Existing AI Costs

Per ai-cost.md:
- Recipe translation (Sonnet): ~$0.011/recipe
- Comment moderation (Haiku): ~$0.00016/comment
- Recipe extraction (Sonnet): ~$0.003-$0.01/import

Nutrition generation at ~$0.001/recipe is:
- 10x cheaper than translation
- Comparable to moderation
- Insignificant compared to extraction

**Conclusion:** Nutrition generation adds ~$0.001 per import, which is immaterial to the existing cost model. Even at 10,000 imports/month, cost is only $10.

### Backfill Cost

If there are 500 existing recipes to backfill:
- One-time cost: 500 × $0.001 = **$0.50**

This is negligible and can be run without concern.

---

## 10. Edge Cases

### Recipe with No Ingredients (Manual Entry Stub)

**Behavior:** Return `null` from `generateNutrition()`, show empty state with "Add ingredients to generate nutrition" message.

**Implementation:**
```typescript
if (!input.ingredients || input.ingredients.length === 0) {
  return null;
}
```

### Recipe with Very Few Ingredients

**Behavior:** Generate with low confidence score. Claude should note limitations.

**Example:** "Salt and pepper to taste"
- Returns confidence ~0.2
- Notes: "Cannot estimate nutrition from seasoning-only ingredients"

### Alcoholic Recipes

**Behavior:** Generate normally, but Claude prompt includes:

> "For alcoholic recipes, note that alcohol calories may vary based on cooking method"

**No special flag needed** — the notes field will contain relevant caveats.

### Recipe with Servings = 0 or NULL

**Behavior:** Assume 4 servings (standard default per CLAUDE.md).

**Implementation:**
```typescript
const servings = input.servings && input.servings > 0 ? input.servings : 4;
```

### Very Large Recipes (50+ Servings)

**Behavior:** Generate normally. Per-serving values will be small; per-100g remains useful.

**No special handling needed** — math scales correctly.

### Retroactive Generation for Existing Recipes

#### Admin Bulk Generation

Add to `/admin/nutrition` page:

```tsx
<div className="bg-cb-card border border-cb-border rounded-card p-4">
  <h3 className="font-semibold mb-2">Bulk Nutrition Generation</h3>
  <p className="text-sm text-cb-secondary mb-4">
    Generate nutrition data for recipes that don't have it yet.
  </p>
  <div className="flex items-center gap-4">
    <span className="text-sm">{recipesWithoutNutrition} recipes pending</span>
    <button
      onClick={startBulkGeneration}
      disabled={bulkRunning}
      className="bg-cb-primary text-white px-4 py-2 rounded-card text-sm"
    >
      {bulkRunning ? `Processing... (${bulkProgress}/${bulkTotal})` : 'Generate All'}
    </button>
  </div>
</div>
```

#### User-Facing Bulk Option

Add a banner on My Recipes when >5 recipes lack nutrition:

```tsx
{recipesWithoutNutrition > 5 && (
  <div className="bg-amber-50 border border-amber-200 rounded-card p-3 mb-4 flex items-center justify-between">
    <span className="text-sm text-amber-800">
      {recipesWithoutNutrition} recipes don't have nutrition data yet.
    </span>
    <button
      onClick={generateForAll}
      className="text-sm font-medium text-amber-900 hover:underline"
    >
      Generate for all →
    </button>
  </div>
)}
```

#### Rate Limiting

Process bulk requests at 1 recipe per second to avoid Anthropic rate limits:
```typescript
for (const recipe of recipesToProcess) {
  await generateNutrition(recipe);
  await new Promise(resolve => setTimeout(resolve, 1000));
}
```

---

## OPEN QUESTIONS

The following decisions require Bob's input before implementation:

### 1. Haiku vs Sonnet for Nutrition Generation

**Question:** Is Haiku (cheaper, ~$0.001/recipe) accurate enough for nutrition estimation, or should we use Sonnet (better quality, ~$0.003/recipe)?

**Recommendation:** Start with Haiku. Upgrade to Sonnet if user feedback indicates estimates are unreliable.

**Action needed:** Bob to confirm model choice.

### 2. Batch Import Behavior

**Question:** Should batch bookmark imports generate nutrition for each recipe (high cost, ~$0.20 for 200 recipes) or skip and offer on-demand generation?

**Recommendation:** Skip during import, offer bulk generation afterward.

**Action needed:** Bob to confirm.

### 3. Confidence Threshold for Display

**Question:** Should we hide nutrition data if confidence is below a threshold (e.g., 0.3)?

**Options:**
- A) Always show, with visual indicator of confidence level
- B) Hide if confidence < 0.3, show "Not enough data" message
- C) Show with warning banner if confidence < 0.5

**Recommendation:** Option A — always show with confidence indicator (users can judge for themselves).

**Action needed:** Bob to confirm.

### 4. Mobile Priority

**Question:** Is mobile nutrition card a launch requirement or can it follow in a later session?

**Recommendation:** Web first, mobile follows in Nutrition-5.

**Action needed:** Bob to confirm launch scope.

### 5. Disclaimer Wording

**Question:** What exact disclaimer text should appear?

**Proposed:** "Estimated by Sous Chef. Not a substitute for professional dietary advice."

**Action needed:** Bob to approve or revise.

---

## Document Complete

This design document covers all 10 required sections. Implementation can begin once open questions are resolved.

**Next step:** Bob reviews this document and answers the 5 open questions, then kicks off Nutrition-1 prompt.
