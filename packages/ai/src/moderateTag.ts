import { callClaude, extractJSON, HAIKU } from './client';

export type TagModerationResult = {
  verdict: 'clean' | 'flagged';
  reason?: string;
};

const TAG_MODERATION_PROMPT = `You are a content moderator for a family-friendly cooking platform.
Evaluate whether this recipe tag is appropriate for all audiences.
A tag should be rejected if it contains: profanity, hate speech,
sexual content, violence, drugs, or any content inappropriate for children.
Cooking-related tags are always acceptable.

Tag: "{{tag}}"

Respond with JSON only: { "verdict": "clean" | "flagged", "reason": "..." }`;

export async function moderateTag(tag: string): Promise<TagModerationResult> {
  const prompt = TAG_MODERATION_PROMPT.replace('{{tag}}', tag.replace(/"/g, '\\"'));
  const text = await callClaude({ prompt, maxTokens: 100, model: HAIKU });
  return extractJSON<TagModerationResult>(text);
}
