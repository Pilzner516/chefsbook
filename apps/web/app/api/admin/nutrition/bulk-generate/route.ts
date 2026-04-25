import { NextRequest } from 'next/server';
import { supabase, supabaseAdmin, logAiCall } from '@chefsbook/db';
import { generateNutrition, consumeLastUsage } from '@chefsbook/ai';

const BATCH_SIZE = 50;
const DELAY_MS = 1000;

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = authHeader.slice(7);
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: admin } = await supabaseAdmin
    .from('admin_users')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!admin) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const limit = typeof body.limit === 'number' ? body.limit : undefined;

  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const encoder = new TextEncoder();

  const send = async (data: unknown) => {
    await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
  };

  (async () => {
    try {
      let processed = 0;
      let errors = 0;
      let skipped = 0;
      let offset = 0;
      let allDone = false;

      while (!allDone) {
        const query = supabaseAdmin
          .from('recipes')
          .select('id, title, servings')
          .is('nutrition', null)
          .order('created_at', { ascending: false })
          .range(offset, offset + BATCH_SIZE - 1);

        const { data: recipes, error: fetchError } = await query;

        if (fetchError) {
          await send({ type: 'error', message: fetchError.message });
          break;
        }

        if (!recipes || recipes.length === 0) {
          allDone = true;
          break;
        }

        const total = limit ?? await getTotalCount();

        for (const recipe of recipes) {
          if (limit && processed >= limit) {
            allDone = true;
            break;
          }

          const { data: ingredients } = await supabaseAdmin
            .from('recipe_ingredients')
            .select('quantity, unit, ingredient')
            .eq('recipe_id', recipe.id)
            .order('sort_order');

          if (!ingredients || ingredients.length === 0) {
            skipped++;
            await send({
              type: 'recipe',
              entry: {
                recipeId: recipe.id,
                title: recipe.title,
                generatedAt: new Date().toISOString(),
                confidence: null,
                status: 'skipped',
                reason: 'no ingredients',
              },
            });
            await send({ type: 'progress', progress: { processed: processed + skipped + errors, total, errors, skipped } });
            continue;
          }

          try {
            const t0 = Date.now();
            const nutrition = await generateNutrition({
              title: recipe.title,
              servings: recipe.servings,
              ingredients: ingredients.map((ing) => ({
                quantity: ing.quantity,
                unit: ing.unit,
                ingredient: ing.ingredient,
              })),
            });

            const usage = consumeLastUsage();
            logAiCall({
              userId: user.id,
              action: 'bulk_generate_nutrition',
              model: usage?.model ?? 'haiku',
              recipeId: recipe.id,
              durationMs: Date.now() - t0,
              tokensIn: usage?.inputTokens,
              tokensOut: usage?.outputTokens,
              success: nutrition !== null,
            }).catch(() => {});

            if (nutrition) {
              await supabaseAdmin
                .from('recipes')
                .update({
                  nutrition,
                  nutrition_generated_at: new Date().toISOString(),
                  nutrition_source: 'ai',
                })
                .eq('id', recipe.id);

              processed++;
              await send({
                type: 'recipe',
                entry: {
                  recipeId: recipe.id,
                  title: recipe.title,
                  generatedAt: new Date().toISOString(),
                  confidence: nutrition.confidence,
                  status: 'success',
                },
              });
            } else {
              errors++;
              await send({
                type: 'recipe',
                entry: {
                  recipeId: recipe.id,
                  title: recipe.title,
                  generatedAt: new Date().toISOString(),
                  confidence: null,
                  status: 'error',
                  reason: 'generation failed',
                },
              });
            }
          } catch (err: any) {
            errors++;
            await send({
              type: 'recipe',
              entry: {
                recipeId: recipe.id,
                title: recipe.title,
                generatedAt: new Date().toISOString(),
                confidence: null,
                status: 'error',
                reason: err.message?.slice(0, 50) ?? 'unknown',
              },
            });
          }

          await send({ type: 'progress', progress: { processed: processed + skipped + errors, total, errors, skipped } });
          await new Promise((r) => setTimeout(r, DELAY_MS));
        }

        if (recipes.length < BATCH_SIZE) {
          allDone = true;
        } else {
          offset = 0;
        }
      }

      await send({ type: 'progress', progress: { processed: processed + skipped + errors, total: processed + skipped + errors, errors, skipped } });
      await writer.write(encoder.encode('data: [DONE]\n\n'));
    } catch (err: any) {
      await send({ type: 'error', message: err.message ?? 'Unknown error' });
    } finally {
      await writer.close();
    }
  })();

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

async function getTotalCount(): Promise<number> {
  const { count } = await supabaseAdmin
    .from('recipes')
    .select('*', { count: 'exact', head: true })
    .is('nutrition', null);
  return count ?? 0;
}
