import { callClaude, extractJSON, HAIKU } from './client';

export async function isUsernameFamilyFriendly(username: string): Promise<boolean> {
  const prompt = `Is the following username family-friendly and appropriate for a cooking app used by all ages?
Username: "${username}"

Rules:
- No profanity or swear words (any language)
- No hate speech or discriminatory terms
- No sexual references
- No violent references
- Common cooking/food terms are always acceptable
- Names, numbers, and common words are acceptable

Return JSON only: { "acceptable": true, "reason": null } or { "acceptable": false, "reason": "brief reason" }`;

  try {
    const text = await callClaude({ prompt, maxTokens: 50, model: HAIKU });
    const result = extractJSON<{ acceptable: boolean; reason: string | null }>(text);
    return result.acceptable;
  } catch {
    // If AI check fails, allow the username (don't block signup on AI error)
    return true;
  }
}
