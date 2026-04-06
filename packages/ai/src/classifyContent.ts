import { callClaude, extractJSON } from './client';

const CLASSIFY_CONTENT_PROMPT = `You are a cooking content classifier. Determine if this content is a RECIPE or a TECHNIQUE.

RECIPE: Produces a specific dish with a list of ingredients and cooking steps.
Examples: Sourdough bread, Chicken tikka masala, Caesar salad, Chocolate cake.

TECHNIQUE: Teaches a cooking method, skill, or process that applies across many dishes. Has no specific ingredient list (or only example ingredients), focuses on method.
Examples: How to brunoise, Sous vide basics, How to make a roux, Knife sharpening, Tempering chocolate, How to deglaze a pan, Braising 101.

Signals for TECHNIQUE:
- Title contains: "how to", "guide", "basics", "101", "method", "technique", "tutorial", "skills", "master", "perfect your"
- Content describes a process applicable to many dishes
- No specific ingredient list, or ingredients are examples only
- Focus is on learning a skill, not producing a finished dish

Return ONLY a JSON object:
{ "content_type": "recipe" | "technique", "confidence": 0.0-1.0, "reason": "brief explanation" }`;

export interface ContentClassification {
  content_type: 'recipe' | 'technique';
  confidence: number;
  reason: string;
}

/**
 * Classify whether content is a recipe or a technique.
 */
export async function classifyContent(
  text: string,
  url: string,
): Promise<ContentClassification> {
  const prompt = `${CLASSIFY_CONTENT_PROMPT}\n\nURL: ${url}\n\nContent (first 1000 chars):\n${text.slice(0, 1000)}`;
  const response = await callClaude({ prompt, maxTokens: 200 });
  return extractJSON<ContentClassification>(response);
}
