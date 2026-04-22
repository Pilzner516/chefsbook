import { supabaseAdmin } from '@chefsbook/db';
import {
  AUDIT_RULES_VERSION,
  STANDARD_RULES,
  DEEP_RULES,
  bulkModerateTags,
  bulkModerateRecipes,
  bulkModerateComments,
  bulkModerateProfiles,
  BATCH_SIZE_TAGS,
  BATCH_SIZE_RECIPES,
  BATCH_SIZE_COMMENTS,
  BATCH_SIZE_PROFILES,
} from '@chefsbook/ai';
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
  // Bulk pricing: cost per batch, not per item
  // Tags: ~$0.003 per 100-tag batch
  // Recipes: ~$0.004 per 20-recipe batch
  // Comments: ~$0.002 per 50-comment batch
  // Profiles/Cookbooks: ~$0.002 per 50-item batch
  const costPerBatch: Record<string, { cost: number; batchSize: number }> = {
    tags: { cost: 0.003, batchSize: BATCH_SIZE_TAGS },
    recipes: { cost: 0.004, batchSize: BATCH_SIZE_RECIPES },
    comments: { cost: 0.002, batchSize: BATCH_SIZE_COMMENTS },
    profiles: { cost: 0.002, batchSize: BATCH_SIZE_PROFILES },
    cookbooks: { cost: 0.002, batchSize: BATCH_SIZE_PROFILES },
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
  const total = scope.reduce((sum, s) => {
    const cfg = costPerBatch[s];
    if (!cfg) return sum;
    const itemCount = counts[s] ?? 0;
    const batchCount = Math.ceil(itemCount / cfg.batchSize);
    return sum + batchCount * cfg.cost;
  }, 0) * multiplier;
  return Math.round(total * 1000000) / 1000000;
}

async function processAudit(runId: string, scope: string[], mode: string) {
  const BATCH_DELAY_MS = 500;

  try {
    const rules = mode === 'deep' ? DEEP_RULES : STANDARD_RULES;
    const findings: any[] = [];
    let totalScanned = 0;

    for (const s of scope) {
      if (s === 'tags') {
        // Get all recipes and extract unique tags with metadata
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

        // Process in batches
        for (let i = 0; i < tags.length; i += BATCH_SIZE_TAGS) {
          const batch = tags.slice(i, i + BATCH_SIZE_TAGS);
          const flagged = await bulkModerateTags(batch.map(t => t.tag), rules);
          totalScanned += batch.length;

          for (const finding of flagged) {
            const tagData = batch[finding.index - 1]; // 1-indexed from prompt
            if (!tagData) continue;
            // For tags, use first recipe_id as content_id (tags don't have their own UUID)
            const firstRecipeId = tagData.recipe_ids?.[0];
            if (!firstRecipeId) continue; // Skip if no recipe uses this tag
            findings.push({
              audit_run_id: runId,
              content_type: 'tag',
              content_id: firstRecipeId,
              content_preview: tagData.tag,
              recipe_id: firstRecipeId,
              recipe_title: `${tagData.recipe_count} recipes use this tag`,
              owner_username: null,
              finding_severity: mode === 'deep' ? 'deep_only' : 'standard',
              reasons: [finding.reason || 'Policy violation'],
              ai_explanation: finding.reason,
            });
          }

          if (i + BATCH_SIZE_TAGS < tags.length) {
            await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
          }
        }
      } else if (s === 'recipes') {
        const { data } = await supabaseAdmin
          .from('recipes')
          .select('id, title, description, notes, user_id');
        const recipes = data ?? [];

        for (let i = 0; i < recipes.length; i += BATCH_SIZE_RECIPES) {
          const batch = recipes.slice(i, i + BATCH_SIZE_RECIPES);
          const flagged = await bulkModerateRecipes(
            batch.map(r => ({ title: r.title, description: r.description, notes: r.notes })),
            rules
          );
          totalScanned += batch.length;

          for (const finding of flagged) {
            const recipe = batch[finding.index - 1];
            if (!recipe) continue;

            // In standard mode, only flag serious/spam; in deep mode, flag mild too
            const shouldFlag = mode === 'deep'
              ? true
              : (finding.verdict === 'serious' || finding.verdict === 'spam');

            if (shouldFlag) {
              findings.push({
                audit_run_id: runId,
                content_type: 'recipe',
                content_id: recipe.id,
                content_preview: recipe.title.substring(0, 80),
                recipe_id: recipe.id,
                recipe_title: recipe.title,
                owner_username: null,
                finding_severity: finding.verdict === 'mild' ? 'deep_only' : 'standard',
                reasons: [finding.verdict],
                ai_explanation: finding.reason || null,
              });
            }
          }

          if (i + BATCH_SIZE_RECIPES < recipes.length) {
            await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
          }
        }
      } else if (s === 'comments') {
        const { data } = await supabaseAdmin
          .from('recipe_comments')
          .select('id, content, recipe_id, user_id');
        const comments = data ?? [];

        for (let i = 0; i < comments.length; i += BATCH_SIZE_COMMENTS) {
          const batch = comments.slice(i, i + BATCH_SIZE_COMMENTS);
          const flagged = await bulkModerateComments(batch.map(c => c.content), rules);
          totalScanned += batch.length;

          for (const finding of flagged) {
            const comment = batch[finding.index - 1];
            if (!comment) continue;

            const shouldFlag = mode === 'deep'
              ? true
              : finding.verdict === 'serious';

            if (shouldFlag) {
              findings.push({
                audit_run_id: runId,
                content_type: 'comment',
                content_id: comment.id,
                content_preview: comment.content.substring(0, 80),
                recipe_id: comment.recipe_id,
                recipe_title: null,
                owner_username: null,
                finding_severity: finding.verdict === 'mild' ? 'deep_only' : 'standard',
                reasons: [finding.verdict],
                ai_explanation: finding.reason || null,
              });
            }
          }

          if (i + BATCH_SIZE_COMMENTS < comments.length) {
            await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
          }
        }
      } else if (s === 'profiles') {
        const { data } = await supabaseAdmin
          .from('user_profiles')
          .select('id, username, bio, display_name')
          .eq('is_searchable', true);
        const profiles = data ?? [];

        for (let i = 0; i < profiles.length; i += BATCH_SIZE_PROFILES) {
          const batch = profiles.slice(i, i + BATCH_SIZE_PROFILES);
          const flagged = await bulkModerateProfiles(
            batch.map(p => ({ display_name: p.display_name, bio: p.bio })),
            rules
          );
          totalScanned += batch.length;

          for (const finding of flagged) {
            const profile = batch[finding.index - 1];
            if (!profile) continue;
            findings.push({
              audit_run_id: runId,
              content_type: 'profile',
              content_id: profile.id,
              content_preview: `${profile.display_name || profile.username}`,
              recipe_id: null,
              recipe_title: null,
              owner_username: profile.username,
              finding_severity: mode === 'deep' ? 'deep_only' : 'standard',
              reasons: finding.fields,
              ai_explanation: finding.reason || null,
            });
          }

          if (i + BATCH_SIZE_PROFILES < profiles.length) {
            await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
          }
        }
      } else if (s === 'cookbooks') {
        const { data } = await supabaseAdmin
          .from('cookbooks')
          .select('id, name, description, user_id')
          .eq('visibility', 'public');
        const cookbooks = data ?? [];

        for (let i = 0; i < cookbooks.length; i += BATCH_SIZE_PROFILES) {
          const batch = cookbooks.slice(i, i + BATCH_SIZE_PROFILES);
          const flagged = await bulkModerateProfiles(
            batch.map(c => ({ display_name: c.name, bio: c.description })),
            rules
          );
          totalScanned += batch.length;

          for (const finding of flagged) {
            const cookbook = batch[finding.index - 1];
            if (!cookbook) continue;
            findings.push({
              audit_run_id: runId,
              content_type: 'cookbook',
              content_id: cookbook.id,
              content_preview: cookbook.name.substring(0, 80),
              recipe_id: null,
              recipe_title: null,
              owner_username: null,
              finding_severity: mode === 'deep' ? 'deep_only' : 'standard',
              reasons: finding.fields,
              ai_explanation: finding.reason || null,
            });
          }

          if (i + BATCH_SIZE_PROFILES < cookbooks.length) {
            await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
          }
        }
      }
    }

    // Insert all findings
    if (findings.length > 0) {
      const { error: insertError } = await supabaseAdmin.from('content_audit_findings').insert(findings);
      if (insertError) {
        throw new Error(`Failed to insert findings: ${insertError.message}`);
      }
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
