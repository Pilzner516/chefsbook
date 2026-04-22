import { callClaude, extractJSON, HAIKU } from './client';

export type ProfileModerationResult = {
  verdict: 'clean' | 'flagged';
  flaggedFields: string[];
  reason?: string;
};

const PROFILE_MODERATION_PROMPT = `You are a content moderator for a family-friendly cooking platform.
Evaluate whether these user profile fields are appropriate for all audiences.
Reject content containing: profanity, hate speech, sexual content,
violence, spam, or anything inappropriate for children.

Fields to check:
Display name: "{{display_name}}"
Bio: "{{bio}}"

Respond with JSON only: { "verdict": "clean" | "flagged",
"flaggedFields": ["bio"|"display_name"], "reason": "..." }`;

export async function moderateProfile(fields: {
  bio?: string;
  display_name?: string;
}): Promise<ProfileModerationResult> {
  const prompt = PROFILE_MODERATION_PROMPT
    .replace('{{display_name}}', (fields.display_name ?? '').replace(/"/g, '\\"'))
    .replace('{{bio}}', (fields.bio ?? '').replace(/"/g, '\\"'));

  const text = await callClaude({ prompt, maxTokens: 150, model: HAIKU });
  return extractJSON<ProfileModerationResult>(text);
}
