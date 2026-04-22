import { supabaseAdmin } from '@chefsbook/db';
import { AUDIT_RULES_VERSION, STANDARD_RULES, DEEP_RULES } from '@chefsbook/ai';
import { moderateTag, moderateRecipe, moderateComment, moderateProfile } from '@chefsbook/ai';
import { NextRequest } from 'next/server';

/**
 * POST /api/admin/audit/start
 * Start a new content audit scan
 * Body: { scope: string[], mode: 'standard' | 'deep' }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { scope, mode } = body;

    if (!Array.isArray(scope) || scope.length === 0) {
      return Response.json({ error: 'Invalid scope' }, { status: 400 });
    }

    if (mode !== 'standard' && mode !== 'deep') {
      return Response.json({ error: 'Invalid mode' }, { status: 400 });
    }

    // Verify admin status
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { data: { user } } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { data: adminUser } = await supabaseAdmin
      .from('admin_users')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!adminUser) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Calculate estimated cost
    const estimatedCost = await calculateEstimatedCost(scope, mode);

    // Create audit run
    const { data: run, error: runError } = await supabaseAdmin
      .from('content_audit_runs')
      .insert({
        run_by: user.id,
        scan_scope: scope,
        scan_mode: mode,
        status: 'running',
        estimated_cost_usd: estimatedCost,
        rules_version: AUDIT_RULES_VERSION,
      })
      .select('id')
      .single();

    if (runError) throw runError;

    // Fire and forget background processing
    processAudit(run.id, scope, mode).catch(console.error);

    return Response.json({ auditRunId: run.id, estimatedCost });
  } catch (err: any) {
    console.error('Admin audit start error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

async function calculateEstimatedCost(scope: string[], mode: string): Promise<number> {
  const costPerItem: Record<string, number> = {
    tags: 0.0002,
    recipes: 0.0004,
    comments: 0.0001,
    profiles: 0.0002,
    cookbooks: 0.0002,
  };

  const counts: Record<string, number> = {};

  for (const s of scope) {
    if (s === 'tags') {
      const { data } = await supabaseAdmin
        .from('recipes')
        .select('tags');
      const allTags = new Set<string>();
      (data ?? []).forEach((r: any) => {
        (r.tags ?? []).forEach((t: string) => allTags.add(t));
      });
      counts.tags = allTags.size;
    } else if (s === 'recipes') {
      const { count } = await supabaseAdmin
        .from('recipes')
        .select('id', { count: 'exact', head: true });
      counts.recipes = count ?? 0;
    } else if (s === 'comments') {
      const { count } = await supabaseAdmin
        .from('recipe_comments')
        .select('id', { count: 'exact', head: true });
      counts.comments = count ?? 0;
    } else if (s === 'profiles') {
      const { count } = await supabaseAdmin
        .from('user_profiles')
        .select('id', { count: 'exact', head: true })
        .eq('is_searchable', true);
      counts.profiles = count ?? 0;
    } else if (s === 'cookbooks') {
      const { count } = await supabaseAdmin
        .from('cookbooks')
        .select('id', { count: 'exact', head: true })
        .eq('visibility', 'public');
      counts.cookbooks = count ?? 0;
    }
  }

  const multiplier = mode === 'deep' ? 1.5 : 1.0;
  const total = scope.reduce((sum, s) => sum + (counts[s] ?? 0) * costPerItem[s], 0) * multiplier;
  return Math.round(total * 1000000) / 1000000; // Round to 6 decimals
}

async function processAudit(runId: string, scope: string[], mode: string) {
  // Retry wrapper with exponential backoff for rate limit errors
  async function withRetry<T>(fn: () => Promise<T>, itemDesc: string): Promise<T> {
    let lastError: any;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        const is429 = error.message?.includes('429') || error.message?.toLowerCase().includes('rate limit');
        if (is429 && attempt < 2) {
          // Exponential backoff: 2s, 4s
          const delay = 2000 * Math.pow(2, attempt);
          console.log(`Rate limit hit on ${itemDesc}, retrying in ${delay}ms (attempt ${attempt + 1}/3)`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          throw error;
        }
      }
    }
    throw lastError;
  }

  try {
    const rules = mode === 'deep' ? DEEP_RULES : STANDARD_RULES;
    const findings: any[] = [];
    let totalScanned = 0;

    for (const s of scope) {
      if (s === 'tags') {
        // Get all recipes and extract unique tags
        const { data } = await supabaseAdmin.from('recipes').select('id, tags, title');
        const tagMap = new Map<string, { count: number; recipe_ids: string[]; title: string }>();

        (data ?? []).forEach((recipe: any) => {
          (recipe.tags ?? []).forEach((tag: string) => {
            const existing = tagMap.get(tag) || { count: 0, recipe_ids: [], title: '' };
            existing.count++;
            existing.recipe_ids.push(recipe.id);
            if (!existing.title) existing.title = recipe.title;
            tagMap.set(tag, existing);
          });
        });

        const tags = Array.from(tagMap.entries()).map(([tag, info]) => ({
          tag,
          recipe_count: info.count,
          recipe_ids: info.recipe_ids,
          sample_title: info.title,
        }));

        for (let i = 0; i < tags.length; i += 10) {
          const batch = tags.slice(i, i + 10);
          await Promise.all(
            batch.map(async (tagData: any) => {
              const result = await withRetry(() => moderateTag(tagData.tag), `tag "${tagData.tag}"`);
              totalScanned++;

              if (result.verdict === 'flagged') {
                findings.push({
                  audit_run_id: runId,
                  content_type: 'tag',
                  content_id: tagData.tag,
                  content_preview: tagData.tag,
                  recipe_id: tagData.recipe_ids?.[0] || null,
                  recipe_title: `${tagData.recipe_count} recipes use this tag`,
                  owner_username: null,
                  finding_severity: mode === 'deep' ? 'deep_only' : 'standard',
                  reasons: [result.reason || 'Policy violation'],
                  ai_explanation: result.reason,
                });
              }
            })
          );
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } else if (s === 'recipes') {
        const { data } = await supabaseAdmin
          .from('recipes')
          .select('id, title, description, notes, user_id');
        const recipes = data ?? [];

        for (let i = 0; i < recipes.length; i += 10) {
          const batch = recipes.slice(i, i + 10);
          await Promise.all(
            batch.map(async (recipe: any) => {
              const result = await withRetry(() => moderateRecipe({
                title: recipe.title,
                description: recipe.description || '',
                notes: recipe.notes || '',
              }), `recipe "${recipe.title}"`);
              totalScanned++;

              // In standard mode, only flag serious/spam; in deep mode, flag mild too
              const shouldFlag = mode === 'deep'
                ? result.verdict !== 'clean'
                : (result.verdict === 'serious' || result.verdict === 'spam');

              if (shouldFlag) {
                findings.push({
                  audit_run_id: runId,
                  content_type: 'recipe',
                  content_id: recipe.id,
                  content_preview: recipe.title.substring(0, 80),
                  recipe_id: recipe.id,
                  recipe_title: recipe.title,
                  owner_username: null,
                  finding_severity: result.verdict === 'mild' ? 'deep_only' : 'standard',
                  reasons: [result.verdict],
                  ai_explanation: result.reason || null,
                });
              }
            })
          );
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } else if (s === 'comments') {
        const { data } = await supabaseAdmin
          .from('recipe_comments')
          .select('id, content, recipe_id, user_id');
        const comments = data ?? [];

        for (let i = 0; i < comments.length; i += 10) {
          const batch = comments.slice(i, i + 10);
          await Promise.all(
            batch.map(async (comment: any) => {
              const result = await withRetry(() => moderateComment(comment.content), `comment ${comment.id}`);
              totalScanned++;

              const shouldFlag = mode === 'deep'
                ? result.verdict !== 'clean'
                : result.verdict === 'serious';

              if (shouldFlag) {
                findings.push({
                  audit_run_id: runId,
                  content_type: 'comment',
                  content_id: comment.id,
                  content_preview: comment.content.substring(0, 80),
                  recipe_id: comment.recipe_id,
                  recipe_title: null,
                  owner_username: null,
                  finding_severity: result.verdict === 'mild' ? 'deep_only' : 'standard',
                  reasons: [result.verdict],
                  ai_explanation: result.reason || null,
                });
              }
            })
          );
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } else if (s === 'profiles') {
        const { data } = await supabaseAdmin
          .from('user_profiles')
          .select('id, username, bio, display_name')
          .eq('is_searchable', true);
        const profiles = data ?? [];

        for (let i = 0; i < profiles.length; i += 10) {
          const batch = profiles.slice(i, i + 10);
          await Promise.all(
            batch.map(async (profile: any) => {
              const result = await withRetry(() => moderateProfile({
                bio: profile.bio || '',
                display_name: profile.display_name || '',
              }), `profile ${profile.username}`);
              totalScanned++;

              if (result.verdict === 'flagged') {
                findings.push({
                  audit_run_id: runId,
                  content_type: 'profile',
                  content_id: profile.id,
                  content_preview: `${profile.display_name || profile.username}`,
                  recipe_id: null,
                  recipe_title: null,
                  owner_username: profile.username,
                  finding_severity: mode === 'deep' ? 'deep_only' : 'standard',
                  reasons: result.flaggedFields,
                  ai_explanation: result.reason || null,
                });
              }
            })
          );
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } else if (s === 'cookbooks') {
        const { data } = await supabaseAdmin
          .from('cookbooks')
          .select('id, name, description, user_id')
          .eq('visibility', 'public');
        const cookbooks = data ?? [];

        for (let i = 0; i < cookbooks.length; i += 10) {
          const batch = cookbooks.slice(i, i + 10);
          await Promise.all(
            batch.map(async (cookbook: any) => {
              const result = await withRetry(() => moderateProfile({
                bio: cookbook.description || '',
                display_name: cookbook.name,
              }), `cookbook "${cookbook.name}"`);
              totalScanned++;

              if (result.verdict === 'flagged') {
                findings.push({
                  audit_run_id: runId,
                  content_type: 'cookbook',
                  content_id: cookbook.id,
                  content_preview: cookbook.name.substring(0, 80),
                  recipe_id: null,
                  recipe_title: null,
                  owner_username: null,
                  finding_severity: mode === 'deep' ? 'deep_only' : 'standard',
                  reasons: result.flaggedFields,
                  ai_explanation: result.reason || null,
                });
              }
            })
          );
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }

    // Insert all findings
    if (findings.length > 0) {
      await supabaseAdmin.from('content_audit_findings').insert(findings);
    }

    // Mark run as complete
    await supabaseAdmin
      .from('content_audit_runs')
      .update({
        status: 'complete',
        total_items_scanned: totalScanned,
        total_flagged: findings.length,
        completed_at: new Date().toISOString(),
      })
      .eq('id', runId);
  } catch (error: any) {
    console.error('Audit processing error:', error);

    // Provide better error message for rate limits
    const is429 = error.message?.includes('429') || error.message?.toLowerCase().includes('rate limit');
    const errorMessage = is429
      ? 'Rate limit hit — try again in a few minutes. Consider reducing scan scope.'
      : error.message;

    await supabaseAdmin
      .from('content_audit_runs')
      .update({
        status: 'failed',
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
      })
      .eq('id', runId);
  }
}
