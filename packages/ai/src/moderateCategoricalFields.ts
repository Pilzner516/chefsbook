import { isTagBlocked, logTagRemoval } from '@chefsbook/db';
import { moderateTag } from './moderateTag';

export interface CategoricalFields {
  tags?: string[];
  cuisine?: string;
  course?: string;
}

export interface ModerationResult {
  tags: string[];           // cleaned tags array
  cuisine: string | null;   // cleaned cuisine or null if removed
  course: string | null;    // cleaned course or null if removed
  removed: Array<{
    field: string;
    value: string;
    reason: 'blocked_list' | 'ai_flagged';
  }>;
}

/**
 * Moderates all categorical fields (tags, cuisine, course) using the same
 * two-step process: blocked list check (fast), then AI check (Haiku).
 *
 * This is called at import time (blocking) and on recipe save handlers (async).
 *
 * @param recipeId - Recipe ID for logging removals
 * @param userId - User ID for logging removals
 * @param fields - Categorical fields to moderate
 * @returns Cleaned fields + list of removed values
 */
export async function moderateCategoricalFields(
  recipeId: string,
  userId: string,
  fields: CategoricalFields
): Promise<ModerationResult> {
  const result: ModerationResult = {
    tags: fields.tags ?? [],
    cuisine: fields.cuisine ?? null,
    course: fields.course ?? null,
    removed: [],
  };

  // Helper to check a single value
  async function checkValue(
    field: string,
    value: string
  ): Promise<boolean> {
    // Skip empty values
    if (!value || !value.trim()) return false;

    // Step 1: blocked list (fast, no AI cost)
    if (await isTagBlocked(value)) {
      await logTagRemoval(recipeId, value, 'blocked_list',
        `${field} field`, userId);
      result.removed.push({ field, value, reason: 'blocked_list' });
      return false; // remove this value
    }

    // Step 2: AI check (Haiku)
    try {
      const verdict = await moderateTag(value);
      if (verdict.verdict === 'flagged') {
        await logTagRemoval(recipeId, value, 'ai',
          verdict.reason ?? `${field} field`, userId);
        result.removed.push({ field, value, reason: 'ai_flagged' });
        return false; // remove this value
      }
    } catch (err) {
      // If AI check fails, log error but keep the value
      // Don't fail the entire import due to moderation error
      console.error(`[moderateCategoricalFields] AI check failed for ${field}:${value}`, err);
    }

    return true; // keep this value
  }

  try {
    // Check tags array
    const cleanTags: string[] = [];
    for (const tag of (fields.tags ?? [])) {
      if (await checkValue('tags', tag)) {
        cleanTags.push(tag);
      }
    }
    result.tags = cleanTags;

    // Check cuisine
    if (fields.cuisine) {
      const keep = await checkValue('cuisine', fields.cuisine);
      result.cuisine = keep ? fields.cuisine : null;
    }

    // Check course
    if (fields.course) {
      const keep = await checkValue('course', fields.course);
      result.course = keep ? fields.course : null;
    }
  } catch (err) {
    // If entire moderation fails, log error and return unmoderated values
    // This ensures imports don't fail due to moderation errors
    console.error('[moderateCategoricalFields] Error during moderation:', err);
    return {
      tags: fields.tags ?? [],
      cuisine: fields.cuisine ?? null,
      course: fields.course ?? null,
      removed: [],
    };
  }

  return result;
}
