import { callClaude, HAIKU } from './client';
import type { CookingPlan } from '@chefsbook/ui';

const CHEF_BRIEFING_PROMPT = `You are Chef, a calm authoritative kitchen conductor. Generate the pre-service briefing
for this cooking session. Speak directly to the chefs by name. Be concise.

CookingPlan: {plan_json}

Rules:
- Address each chef by name with their primary responsibilities
- Mention the serve target time if set
- Flag any oven conflicts honestly but calmly — one sentence maximum
- End with "Let's go."
- Maximum 120 words total
- No bullet points — this is spoken aloud
- Tone: head chef before service, not a chatbot`;

function truncateAtSentenceBoundary(text: string, maxWords: number): string {
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return text;

  // Find the last sentence boundary within the word limit
  const truncated = words.slice(0, maxWords).join(' ');
  const lastSentenceEnd = Math.max(
    truncated.lastIndexOf('. '),
    truncated.lastIndexOf('! '),
    truncated.lastIndexOf('? '),
  );

  if (lastSentenceEnd > 0) {
    return truncated.slice(0, lastSentenceEnd + 1);
  }

  // No sentence boundary found — return truncated text
  return truncated;
}

export async function generateChefBriefing(plan: CookingPlan): Promise<string> {
  const prompt = CHEF_BRIEFING_PROMPT.replace('{plan_json}', JSON.stringify(plan));
  const text = await callClaude({ prompt, maxTokens: 300, model: HAIKU });

  const trimmed = text.trim();

  // Enforce 120-word limit, truncate at sentence boundary, ensure ends with "Let's go."
  const truncated = truncateAtSentenceBoundary(trimmed, 120);

  if (truncated.endsWith("Let's go.")) {
    return truncated;
  }

  // Strip any trailing partial sentence and append "Let's go."
  const lastSentenceEnd = Math.max(
    truncated.lastIndexOf('. '),
    truncated.lastIndexOf('! '),
    truncated.lastIndexOf('? '),
  );

  if (lastSentenceEnd > 0) {
    return truncated.slice(0, lastSentenceEnd + 1) + " Let's go.";
  }

  return truncated + " Let's go.";
}
