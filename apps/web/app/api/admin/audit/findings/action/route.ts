import { supabaseAdmin, blockTag, logTagRemoval } from '@chefsbook/db';
import { NextRequest } from 'next/server';

/**
 * POST /api/admin/audit/findings/action
 * Take action on one or more findings
 * Body: { findingIds: string[], action: 'ignore' | 'make_private' | 'hide' | 'delete' | 'flag' | 'block_tag' }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { findingIds, action } = body;

    if (!Array.isArray(findingIds) || findingIds.length === 0) {
      return Response.json({ error: 'Invalid findingIds' }, { status: 400 });
    }

    if (!['ignore', 'make_private', 'hide', 'delete', 'flag', 'block_tag'].includes(action)) {
      return Response.json({ error: 'Invalid action' }, { status: 400 });
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

    // Get findings
    const { data: findings, error: findingsError } = await supabaseAdmin
      .from('content_audit_findings')
      .select('*')
      .in('id', findingIds);

    if (findingsError) throw findingsError;

    // Apply action to each finding
    for (const finding of findings ?? []) {
      if (action === 'ignore') {
        // Just mark as ignored, no content change
        await supabaseAdmin
          .from('content_audit_findings')
          .update({
            action_taken: 'ignored',
            action_taken_by: user.id,
            action_taken_at: new Date().toISOString(),
          })
          .eq('id', finding.id);
      } else if (action === 'make_private') {
        if (finding.content_type === 'recipe') {
          await supabaseAdmin
            .from('recipes')
            .update({ visibility: 'private' })
            .eq('id', finding.content_id);

          await supabaseAdmin
            .from('content_audit_findings')
            .update({
              action_taken: 'made_private',
              action_taken_by: user.id,
              action_taken_at: new Date().toISOString(),
            })
            .eq('id', finding.id);
        }
      } else if (action === 'hide') {
        if (finding.content_type === 'recipe') {
          await supabaseAdmin
            .from('recipes')
            .update({ moderation_status: 'hidden' })
            .eq('id', finding.content_id);
        } else if (finding.content_type === 'comment') {
          await supabaseAdmin
            .from('recipe_comments')
            .update({ is_hidden: true })
            .eq('id', finding.content_id);
        }

        await supabaseAdmin
          .from('content_audit_findings')
          .update({
            action_taken: 'hidden',
            action_taken_by: user.id,
            action_taken_at: new Date().toISOString(),
          })
          .eq('id', finding.id);
      } else if (action === 'delete') {
        if (finding.content_type === 'recipe') {
          await supabaseAdmin
            .from('recipes')
            .delete()
            .eq('id', finding.content_id);
        } else if (finding.content_type === 'comment') {
          await supabaseAdmin
            .from('recipe_comments')
            .delete()
            .eq('id', finding.content_id);
        } else if (finding.content_type === 'cookbook') {
          await supabaseAdmin
            .from('cookbooks')
            .delete()
            .eq('id', finding.content_id);
        }

        await supabaseAdmin
          .from('content_audit_findings')
          .update({
            action_taken: 'deleted',
            action_taken_by: user.id,
            action_taken_at: new Date().toISOString(),
          })
          .eq('id', finding.id);
      } else if (action === 'flag') {
        if (finding.content_type === 'recipe') {
          await supabaseAdmin
            .from('recipe_flags')
            .insert({
              recipe_id: finding.content_id,
              flagged_by: null, // AI/admin flag
              flag_type: 'policy_violation',
              reason: finding.ai_explanation || 'Flagged during content audit',
              status: 'pending',
            });

          await supabaseAdmin
            .from('content_audit_findings')
            .update({
              action_taken: 'flagged',
              action_taken_by: user.id,
              action_taken_at: new Date().toISOString(),
            })
            .eq('id', finding.id);
        }
      } else if (action === 'block_tag') {
        if (finding.content_type === 'tag') {
          // content_preview contains the actual tag string (content_id is a recipe UUID)
          const tagToBlock = finding.content_preview;
          if (!tagToBlock) continue;

          // Block the tag
          await blockTag(tagToBlock, 'Blocked from content audit', user.id);

          // Find all recipes that have this tag and remove it
          const { data: recipesWithTag } = await supabaseAdmin
            .from('recipes')
            .select('id, tags')
            .contains('tags', [tagToBlock]);

          for (const recipe of recipesWithTag ?? []) {
            const newTags = (recipe.tags ?? []).filter((t: string) => t.toLowerCase() !== tagToBlock.toLowerCase());
            await supabaseAdmin
              .from('recipes')
              .update({ tags: newTags })
              .eq('id', recipe.id);

            // Log the removal
            await logTagRemoval(recipe.id, tagToBlock, 'admin', 'Blocked from content audit', user.id);
          }

          await supabaseAdmin
            .from('content_audit_findings')
            .update({
              action_taken: 'ignored', // Marked as handled
              action_taken_by: user.id,
              action_taken_at: new Date().toISOString(),
            })
            .eq('id', finding.id);
        }
      }
    }

    return Response.json({ success: true, processed: findings?.length ?? 0 });
  } catch (err: any) {
    console.error('Admin audit action error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
