import { callClaude, extractJSON, HAIKU } from './client';

export type MessageModerationResult = {
  verdict: 'clean' | 'mild' | 'serious';
  reason?: string | null;
};

const PROMPT = `You are a content moderator for a family-friendly recipe sharing app.
Review the following direct message for violations.

Rules:
- No swearing or profanity (any language)
- No hate speech or discrimination
- No personal attacks or harassment
- No spam or promotional content
- No sexual or violent content
- Must be family-friendly

Message: "{{content}}"

Classify as:
- "clean": no violations
- "mild": borderline language, minor rudeness (deliver but flag for review)
- "serious": clear profanity, hate speech, harassment, explicit content (hide immediately)

Return JSON only:
{
  "verdict": "clean" | "mild" | "serious",
  "reason": "brief explanation if not clean, null if clean"
}`;

export async function moderateMessage(content: string): Promise<MessageModerationResult> {
  const prompt = PROMPT.replace('{{content}}', content.replace(/"/g, '\\"'));
  const text = await callClaude({ prompt, maxTokens: 100, model: HAIKU });
  return extractJSON<MessageModerationResult>(text);
}
