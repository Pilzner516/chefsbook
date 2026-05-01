import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logAiCall, getPrimaryPhotos } from '@chefsbook/db';
import { completeInstagramRecipe } from '@chefsbook/ai';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

const MAX_ATTEMPTS = 3;
const BATCH_SIZE = 5;

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Claim pending jobs atomically
    const { data: pendingJobs } = await supabaseAdmin
      .from('import_completion_jobs')
      .select('id, recipe_id')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .lt('attempts', MAX_ATTEMPTS)
      .order('created_at', { ascending: true })
      .limit(BATCH_SIZE);

    if (!pendingJobs || pendingJobs.length === 0) {
      return NextResponse.json({ processed: 0, succeeded: 0, failed: 0 });
    }

    const jobIds = pendingJobs.map(j => j.id);

    // Mark as processing
    await supabaseAdmin
      .from('import_completion_jobs')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .in('id', jobIds);

    let succeeded = 0;
    let failed = 0;

    for (const job of pendingJobs) {
      try {
        const { data: recipe } = await supabaseAdmin
          .from('recipes')
          .select('id, title, notes, tags, user_id')
          .eq('id', job.recipe_id)
          .single();

        if (!recipe) {
          await markJobFailed(job.id, 'Recipe not found');
          failed++;
          continue;
        }

        const primaryPhotos = await getPrimaryPhotos([job.recipe_id]);
        const photoUrl = primaryPhotos[job.recipe_id];

        if (!photoUrl) {
          await markJobFailed(job.id, 'No photo found');
          failed++;
          continue;
        }

        const imageResponse = await fetch(photoUrl, {
          headers: { apikey: supabaseAnonKey },
        });

        if (!imageResponse.ok) {
          await markJobFailed(job.id, 'Failed to fetch image');
          failed++;
          continue;
        }

        const imageBuffer = await imageResponse.arrayBuffer();
        const imageBase64 = Buffer.from(imageBuffer).toString('base64');

        const result = await completeInstagramRecipe({
          title: recipe.title,
          notes: recipe.notes,
          imageBase64,
        });

        await logAiCall({
          userId: user.id,
          action: 'instagram_recipe_complete',
          model: 'sonnet',
          tokensIn: result.tokensIn ?? 0,
          tokensOut: result.tokensOut ?? 0,
          recipeId: job.recipe_id,
          success: result.success,
          metadata: result.error ? { error: result.error } : undefined,
        });

        if (!result.success || !result.data) {
          await markJobFailed(job.id, result.error || 'Generation failed');
          failed++;
          continue;
        }

        const { data: recipeData } = result;

        // Insert ingredients
        const ingredientRows = recipeData.ingredients.map((ing, idx) => ({
          recipe_id: job.recipe_id,
          user_id: recipe.user_id,
          ingredient: ing.name,
          quantity: ing.amount || '',
          unit: ing.unit || '',
          sort_order: idx,
        }));

        await supabaseAdmin.from('recipe_ingredients').insert(ingredientRows);

        // Insert steps
        const stepRows = recipeData.steps.map((step, idx) => ({
          recipe_id: job.recipe_id,
          user_id: recipe.user_id,
          step_number: idx + 1,
          instruction: step.instruction,
        }));

        await supabaseAdmin.from('recipe_steps').insert(stepRows);

        // Update recipe
        const updatedTags = (recipe.tags || []).filter((t: string) => t !== '_incomplete');

        await supabaseAdmin
          .from('recipes')
          .update({
            description: recipeData.description,
            cuisine: recipeData.cuisine || null,
            is_complete: true,
            tags: updatedTags,
          })
          .eq('id', job.recipe_id);

        // Call finalize
        try {
          await fetch('http://localhost:3000/api/recipes/finalize', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ recipeId: job.recipe_id }),
          });
        } catch (finalizeError) {
          console.error('[process-jobs] Finalize error:', finalizeError);
        }

        // Mark complete
        await supabaseAdmin
          .from('import_completion_jobs')
          .update({ status: 'complete', updated_at: new Date().toISOString() })
          .eq('id', job.id);

        succeeded++;
      } catch (error: any) {
        console.error(`[process-jobs] Error processing job ${job.id}:`, error);
        await markJobFailed(job.id, error.message || 'Unknown error');
        failed++;
      }
    }

    return NextResponse.json({ processed: pendingJobs.length, succeeded, failed });
  } catch (error) {
    console.error('[process-jobs] Error:', error);
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}

async function markJobFailed(jobId: string, errorMessage: string) {
  const { data: job } = await supabaseAdmin
    .from('import_completion_jobs')
    .select('attempts')
    .eq('id', jobId)
    .single();

  const newAttempts = (job?.attempts || 0) + 1;
  const newStatus = newAttempts >= MAX_ATTEMPTS ? 'failed' : 'pending';

  await supabaseAdmin
    .from('import_completion_jobs')
    .update({
      status: newStatus,
      attempts: newAttempts,
      error_message: errorMessage,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId);
}
