import { jsonrepair } from 'jsonrepair';
import { callClaude, HAIKU } from './client';
import { shouldExcludeFromModeration } from '@chefsbook/db';

// Batch sizes for each content type
const BATCH_SIZE_TAGS = 100;
const BATCH_SIZE_RECIPES = 20;
const BATCH_SIZE_COMMENTS = 50;
const BATCH_SIZE_PROFILES = 50;

export { BATCH_SIZE_TAGS, BATCH_SIZE_RECIPES, BATCH_SIZE_COMMENTS, BATCH_SIZE_PROFILES };

export type BulkTagFinding = {
  index: number;
  tag: string;
  reason: string;
};

export type BulkRecipeFinding = {
  index: number;
  verdict: 'mild' | 'serious' | 'spam';
  reason: string;
  fields?: string[];
};

export type BulkCommentFinding = {
  index: number;
  verdict: 'mild' | 'serious';
  reason: string;
};

export type BulkProfileFinding = {
  index: number;
  reason: string;
  fields: string[];
};

function parseJsonResponse<T>(text: string): T {
  const match = text.match(/```json\s*([\s\S]*?)```/) ?? text.match(/(\[[\s\S]*\])/);
  if (!match) {
    if (text.trim() === '[]' || text.includes('[]')) return [] as T;
    throw new Error('No JSON array found in Claude response');
  }
  const raw = match[1] ?? match[0];
  try {
    return JSON.parse(raw);
  } catch {
    return JSON.parse(jsonrepair(raw));
  }
}

export async function bulkModerateTags(
  tags: string[],
  rules: string
): Promise<BulkTagFinding[]> {
  if (tags.length === 0) return [];

  // Filter out source domain tags and system tags, but track original indices
  const filteredTags: Array<{ tag: string; originalIndex: number }> = [];
  for (let i = 0; i < tags.length; i++) {
    if (!shouldExcludeFromModeration(tags[i])) {
      filteredTags.push({ tag: tags[i], originalIndex: i });
    }
  }

  // If all tags are excluded, return empty
  if (filteredTags.length === 0) return [];

  const tagList = filteredTags.map((t, i) => `${i + 1}. "${t.tag.replace(/"/g, '\\"')}"`).join('\n');

  const prompt = `You are a content moderator for a family-friendly cooking platform.
Review this list of recipe tags for policy violations.

Guidelines:
${rules}

Tags to review (numbered):
${tagList}

Return JSON ONLY — an array of FLAGGED items (omit clean items):
[
  { "index": 1, "tag": "example", "reason": "why it was flagged" }
]
If ALL tags are clean, return: []`;

  const text = await callClaude({ prompt, maxTokens: 1500, model: HAIKU });
  const aiFindings = parseJsonResponse<BulkTagFinding[]>(text);

  // Map AI's 1-based indices back to original 1-based indices
  return aiFindings.map(finding => {
    const filtered = filteredTags[finding.index - 1];
    return {
      ...finding,
      index: filtered ? filtered.originalIndex + 1 : finding.index,
    };
  });
}

export async function bulkModerateRecipes(
  recipes: Array<{ title: string; description?: string | null; notes?: string | null }>,
  rules: string
): Promise<BulkRecipeFinding[]> {
  if (recipes.length === 0) return [];

  const recipeList = recipes.map((r, i) => `---
#${i + 1} | Title: "${(r.title ?? '').replace(/"/g, '\\"')}"
   | Description: "${(r.description ?? '').slice(0, 200).replace(/"/g, '\\"')}"
   | Notes: "${(r.notes ?? '').slice(0, 100).replace(/"/g, '\\"')}"`).join('\n');

  const prompt = `You are a content moderator for a family-friendly recipe sharing app.
Review these recipes for policy violations.

Guidelines:
${rules}

Recipes to review:
${recipeList}
---

Classify each flagged recipe as: mild | serious | spam
- "mild": borderline content, slightly inappropriate but not severe
- "serious": clear profanity, sexual/violent content, hate speech
- "spam": promotional content, URLs, contact info, keyword stuffing, non-food content

Return JSON ONLY — an array of FLAGGED recipes (omit clean ones):
[
  { "index": 1, "verdict": "spam", "reason": "why flagged", "fields": ["title"] }
]
If ALL recipes are clean, return: []`;

  const text = await callClaude({ prompt, maxTokens: 2000, model: HAIKU });
  return parseJsonResponse<BulkRecipeFinding[]>(text);
}

export async function bulkModerateComments(
  comments: string[],
  rules: string
): Promise<BulkCommentFinding[]> {
  if (comments.length === 0) return [];

  const commentList = comments.map((c, i) => `${i + 1}. "${c.slice(0, 200).replace(/"/g, '\\"')}"`).join('\n');

  const prompt = `You are a content moderator for a family-friendly recipe sharing app.
Review these user comments for policy violations.

Guidelines:
${rules}

Comments to review:
${commentList}

Classify each flagged comment as: mild | serious
- "mild": borderline language, minor rudeness, slightly off-topic
- "serious": clear profanity, hate speech, harassment, explicit content

Return JSON ONLY — an array of FLAGGED comments (omit clean ones):
[
  { "index": 1, "verdict": "serious", "reason": "personal attack" }
]
If ALL comments are clean, return: []`;

  const text = await callClaude({ prompt, maxTokens: 1500, model: HAIKU });
  return parseJsonResponse<BulkCommentFinding[]>(text);
}

export async function bulkModerateProfiles(
  profiles: Array<{ display_name?: string | null; bio?: string | null }>,
  rules: string
): Promise<BulkProfileFinding[]> {
  if (profiles.length === 0) return [];

  const profileList = profiles.map((p, i) => `---
#${i + 1} | Display name: "${(p.display_name ?? '').replace(/"/g, '\\"')}"
   | Bio: "${(p.bio ?? '').slice(0, 200).replace(/"/g, '\\"')}"`).join('\n');

  const prompt = `You are a content moderator for a family-friendly cooking platform.
Review these user profiles for policy violations.

Guidelines:
${rules}

Profiles to review:
${profileList}
---

Return JSON ONLY — an array of FLAGGED profiles (omit clean ones):
[
  { "index": 1, "reason": "inappropriate content", "fields": ["display_name", "bio"] }
]
If ALL profiles are clean, return: []`;

  const text = await callClaude({ prompt, maxTokens: 1500, model: HAIKU });
  return parseJsonResponse<BulkProfileFinding[]>(text);
}
