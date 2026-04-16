import { callClaude, extractJSON, HAIKU, SONNET } from './client';

/**
 * Detect the language of recipe text using heuristics first, then Haiku fallback.
 * Returns a 2-letter ISO code (en, fr, de, it, es, etc.)
 * ~$0.0001 per call when Haiku is needed; often free via heuristic.
 */
export async function detectLanguage(text: string): Promise<string> {
  if (!text || text.length < 10) return 'en';

  const sample = text.slice(0, 500);

  // Heuristic: check for language-specific character patterns + common words
  const germanPattern = /[äöüßÄÖÜ]|(?:\b(?:und|mit|oder|für|ein|eine|das|die|der|nicht|auf|den)\b)/i;
  const frenchPattern = /[àâçéèêëîïôùûüÿæœ]|(?:\b(?:les|des|une|dans|avec|pour|sur|est|pas|qui|que)\b)/i;
  const italianPattern = /(?:\b(?:con|del|della|delle|gli|una|nel|nella|sono|per|che|alla|alle|questo)\b)/i;
  const spanishPattern = /[áéíóúñ¿¡]|(?:\b(?:con|del|los|las|una|para|por|que|esta|pero|como|más)\b)/i;
  const portuguesePattern = /[ãõç]|(?:\b(?:com|dos|das|uma|para|não|mais|são|pelo|pela|também)\b)/i;

  // Count matches for each language
  const counts: Record<string, number> = { de: 0, fr: 0, it: 0, es: 0, pt: 0 };
  const words = sample.split(/\s+/);
  for (const w of words) {
    if (germanPattern.test(w)) counts.de++;
    if (frenchPattern.test(w)) counts.fr++;
    if (italianPattern.test(w)) counts.it++;
    if (spanishPattern.test(w)) counts.es++;
    if (portuguesePattern.test(w)) counts.pt++;
  }

  // If any non-English language has 3+ matches, declare it
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  if (best[1] >= 3) return best[0];

  // If text appears to be entirely ASCII with common English words, assume English
  const englishWords = /\b(?:the|and|with|for|this|that|from|into|then|until|about|cook|bake|stir|mix|add|heat|preheat|serve)\b/gi;
  const englishCount = (sample.match(englishWords) || []).length;
  if (englishCount >= 3) return 'en';

  // Haiku fallback for ambiguous text
  try {
    const response = await callClaude({
      model: HAIKU,
      prompt: `What language is this recipe text? Reply with ONLY the 2-letter ISO code (en, fr, de, it, es, pt, nl, pl, sv, etc.): "${sample.slice(0, 200)}"`,
      maxTokens: 10,
    });
    const code = response.trim().toLowerCase().slice(0, 2);
    if (/^[a-z]{2}$/.test(code)) return code;
  } catch { /* fall through */ }

  return 'en';
}

/**
 * Translate a recipe's content from one language to another.
 * Uses Sonnet for quality translation — ~$0.003 per recipe.
 * Only called when source language !== user language.
 */
export async function translateRecipeContent(
  recipe: {
    title: string;
    description?: string | null;
    ingredients?: Array<{ quantity?: number | null; unit?: string | null; ingredient: string; preparation?: string | null; optional?: boolean; group_label?: string | null }>;
    steps?: Array<{ step_number?: number; instruction: string; timer_minutes?: number | null; group_label?: string | null }>;
    cuisine?: string | null;
    tags?: string[];
  },
  targetLanguage: string,
  sourceLanguage: string,
): Promise<typeof recipe & { source_language: string; translated_from: string }> {
  if (sourceLanguage === targetLanguage) {
    return { ...recipe, source_language: sourceLanguage, translated_from: sourceLanguage };
  }

  const langNames: Record<string, string> = {
    en: 'English', fr: 'French', de: 'German', it: 'Italian',
    es: 'Spanish', pt: 'Portuguese', nl: 'Dutch', pl: 'Polish',
    sv: 'Swedish', no: 'Norwegian', da: 'Danish', fi: 'Finnish',
  };

  const from = langNames[sourceLanguage] ?? sourceLanguage;
  const to = langNames[targetLanguage] ?? targetLanguage;

  const ingredientsList = (recipe.ingredients ?? []).map((i) =>
    `${i.quantity ?? ''} ${i.unit ?? ''} ${i.ingredient}${i.preparation ? ` (${i.preparation})` : ''}`.trim()
  );
  const stepsList = (recipe.steps ?? []).map((s) => s.instruction);
  // Filter out system/metadata tags (prefixed with _ or known system tags)
  const systemTags = new Set(['ChefsBook', 'ChefsBook-v2', '_incomplete', '_unresolved']);
  const userTags = (recipe.tags ?? []).filter((t) => !systemTags.has(t) && !t.startsWith('_') && !/\.(com|org|net|it|de|fr|es|nl|no|dk|pl)$/.test(t));

  const prompt = `Translate this recipe from ${from} to ${to}.

Rules:
- Translate title, description, ingredient NAMES, preparation notes, step instructions, and tags
- Keep ALL quantities and units EXACTLY as-is (numbers, g, ml, cups, tsp, etc.)
- Keep cooking temperatures, times, and measurements exact
- Tags must be short lowercase ${to} words (e.g. "chicken", "baked", "quick", "comfort-food")
- Preserve the recipe's style and voice
- Return ONLY valid JSON:

{
  "title": "translated title",
  "description": "translated description or null",
  "ingredients": ["translated ingredient line 1", "translated ingredient line 2"],
  "steps": ["translated step 1", "translated step 2"],
  "tags": ["translated-tag-1", "translated-tag-2"]
}

Recipe:
Title: ${recipe.title}
Description: ${recipe.description ?? 'none'}
Ingredients:
${ingredientsList.map((ing, i) => `${i + 1}. ${ing}`).join('\n')}
Steps:
${stepsList.map((s, i) => `${i + 1}. ${s}`).join('\n')}
Tags: ${userTags.join(', ') || 'none'}`;

  try {
    const raw = await callClaude({ model: SONNET, prompt, maxTokens: 4000 });
    const translated = extractJSON<{
      title: string;
      description: string | null;
      ingredients: string[];
      steps: string[];
      tags?: string[];
    }>(raw);

    // Merge translated ingredient names back into the structured format
    const mergedIngredients = (recipe.ingredients ?? []).map((orig, i) => {
      if (i < translated.ingredients.length) {
        const translatedLine = translated.ingredients[i];
        return { ...orig, ingredient: translatedLine };
      }
      return orig;
    });

    // Merge translated steps back into the structured format
    const mergedSteps = (recipe.steps ?? []).map((orig, i) => {
      if (i < translated.steps.length) {
        return { ...orig, instruction: translated.steps[i] };
      }
      return orig;
    });

    // Merge tags: keep system/domain tags as-is, replace user tags with translated ones
    const keptTags = (recipe.tags ?? []).filter((t) => systemTags.has(t) || t.startsWith('_') || /\.(com|org|net|it|de|fr|es|nl|no|dk|pl)$/.test(t));
    const translatedTags = (translated.tags ?? []).map((t) => t.toLowerCase().trim()).filter(Boolean);
    const mergedTags = [...keptTags, ...translatedTags];

    return {
      ...recipe,
      title: translated.title ?? recipe.title,
      description: translated.description ?? recipe.description,
      ingredients: mergedIngredients,
      steps: mergedSteps,
      tags: mergedTags.length > 0 ? mergedTags : recipe.tags,
      source_language: sourceLanguage,
      translated_from: sourceLanguage,
    };
  } catch (err) {
    console.error('Recipe translation failed:', err);
    return { ...recipe, source_language: sourceLanguage, translated_from: sourceLanguage };
  }
}
