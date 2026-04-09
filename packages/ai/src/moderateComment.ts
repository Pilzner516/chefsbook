import { callClaude, extractJSON } from './client';

export type ModerationResult = {
  verdict: 'clean' | 'mild' | 'serious';
  reason?: string | null;
};

const MODERATION_PROMPT = `You are a content moderator for a family-friendly recipe sharing app.
Review the following comment for violations.

Rules:
- No swearing or profanity (any language)
- No hate speech or discrimination
- No personal attacks or harassment
- No spam or promotional content
- No off-topic content unrelated to cooking/food
- No sexual or violent content
- Must be family-friendly

Comment: "{{content}}"

Classify as:
- "clean": no violations
- "mild": borderline language, minor rudeness, slightly off-topic (show comment but flag for review)
- "serious": clear profanity, hate speech, harassment, explicit content (hide comment immediately)

Return JSON only:
{
  "verdict": "clean" | "mild" | "serious",
  "reason": "brief explanation if not clean, null if clean"
}`;

export async function moderateComment(content: string): Promise<ModerationResult> {
  const prompt = MODERATION_PROMPT.replace('{{content}}', content.replace(/"/g, '\\"'));
  const text = await callClaude({ prompt, maxTokens: 200 });
  return extractJSON<ModerationResult>(text);
}
