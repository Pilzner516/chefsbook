import { createClient } from '@supabase/supabase-js';
import { callClaude, extractJSON, consumeLastUsage, suggestTagsForRecipe, moderateTag } from '@chefsbook/ai';
import { logAiCall, fetchRecipeCompleteness, applyCompletenessGate } from '@chefsbook/db';

function getServiceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '', process.env.SUPABASE_SERVICE_ROLE_KEY ?? '');
}

const TAG_PROMPT = `Analyze this recipe and return cuisine, course, and tags.

Rules for course:
- Waffles, pancakes, eggs, french toast, oatmeal, granola → breakfast
- Sandwiches, wraps, light soups, salads → lunch
- Pasta, roasts, stews, grills, curries, heavy proteins → dinner
- Lamb, beef roast, whole chicken, prime rib → dinner
- Cakes, cookies, pies, ice cream, pudding → dessert
- Chips, dips, nuts, energy bites → snack
- Smoothies, cocktails, coffee drinks → drink
- Rice dishes, potato dishes, vegetable sides → side
- Appetizers, bruschetta, small bites → starter
- Breads, rolls, focaccia, biscuits, pretzels → bread
- If lunch/dinner ambiguous, pick the more likely one

Return ONLY JSON:
{ "cuisine": "string", "course": "string", "tags": ["string"] }

Tags should be 5-8 lowercase strings covering: main protein (chicken, beef, fish, vegetarian, vegan), cooking method (baked, grilled, fried, slow-cooked, no-knead), characteristics (quick, one-pot, meal-prep, comfort-food), diet flags (gluten-free, dairy-free) if applicable.`;

export async function POST(req: Request) {
  const db = getServiceClient();

  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: { user } } = await db.auth.getUser(authHeader.slice(7));
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  // Single-recipe mode: if body has recipeId, tag just that one recipe (used by
  // post-import fire-and-forget from saveWithModeration + extension import).
  let singleRecipeId: string | null = null;
  try {
    const body = await req.json();
    if (body?.recipeId && typeof body.recipeId === 'string') singleRecipeId = body.recipeId;
  } catch { /* empty body is fine — bulk mode */ }

  if (singleRecipeId) {
    const t0 = Date.now();
    const { data: r } = await db
      .from('recipes')
      .select('id, user_id, title, description, cuisine, course, tags')
      .eq('id', singleRecipeId)
      .single();
    if (!r) return Response.json({ error: 'Recipe not found' }, { status: 404 });
    if (r.user_id !== user.id) return Response.json({ error: 'Not your recipe' }, { status: 403 });

    try {
      const { data: ings } = await db.from('recipe_ingredients').select('ingredient').eq('recipe_id', r.id).limit(10);
      const result = await suggestTagsForRecipe({
        title: r.title,
        description: r.description,
        ingredients: (ings ?? []).map((i: any) => i.ingredient).filter(Boolean),
      });

      const updates: Record<string, unknown> = {};
      if ((!r.cuisine || r.cuisine === '') && result.cuisine) updates.cuisine = result.cuisine;
      if ((!r.course || r.course === '') && result.course) updates.course = result.course;
      const existing: string[] = r.tags ?? [];
      let newTags = result.tags.filter((t) => !existing.includes(t));

      // Moderate tags at import time (blocking — before save)
      const cleanTags: string[] = [];
      for (const tag of newTags) {
        try {
          const modResult = await moderateTag(tag);
          await logAiCall({
            userId: user.id,
            action: 'moderate_tag',
            model: 'haiku',
            recipeId: r.id,
            success: true,
          });
          if (modResult.verdict === 'clean') {
            cleanTags.push(tag);
          }
        } catch {
          // On moderation failure, allow the tag (don't block import)
          cleanTags.push(tag);
        }
      }

      if (cleanTags.length > 0) updates.tags = [...existing, ...cleanTags];

      if (Object.keys(updates).length > 0) {
        // Remove _incomplete tag if present — auto-tag may have made the recipe complete
        const finalTags: string[] = (updates.tags as string[] | undefined) ?? existing;
        if (finalTags.includes('_incomplete')) {
          updates.tags = finalTags.filter((t: string) => t !== '_incomplete');
        }
        await db.from('recipes').update(updates).eq('id', r.id);

        // Re-run completeness gate — tags were just added, recipe may now be complete
        try {
          const completeness = await fetchRecipeCompleteness(r.id);
          await applyCompletenessGate(r.id, completeness);
        } catch { /* non-critical — don't fail the tag response */ }
      }

      const u = consumeLastUsage();
      logAiCall({
        userId: user.id,
        action: 'suggest_tags',
        model: 'haiku',
        recipeId: r.id,
        durationMs: Date.now() - t0,
        tokensIn: u?.inputTokens,
        tokensOut: u?.outputTokens,
        success: true,
      }).catch(() => {});

      return Response.json({ updated: Object.keys(updates).length > 0, tagsAdded: newTags.length });
    } catch (err: any) {
      logAiCall({
        userId: user.id,
        action: 'suggest_tags',
        model: 'haiku',
        recipeId: r.id,
        durationMs: Date.now() - t0,
        success: false,
      }).catch(() => {});
      return Response.json({ error: err?.message ?? 'suggest_tags failed' }, { status: 500 });
    }
  }

  // Bulk mode: find recipes needing tags
  const { data: recipes } = await db
    .from('recipes')
    .select('id, title, description, cuisine, course, tags')
    .eq('user_id', user.id)
    .or('cuisine.is.null,cuisine.eq.,course.is.null,course.eq.');

  // Also find recipes with too few tags
  const { data: lowTags } = await db
    .from('recipes')
    .select('id, title, description, cuisine, course, tags')
    .eq('user_id', user.id)
    .not('id', 'in', `(${(recipes ?? []).map((r) => `'${r.id}'`).join(',') || "'none'"})`);

  const allNeedingWork = [
    ...(recipes ?? []),
    ...(lowTags ?? []).filter((r) => !r.tags || r.tags.length < 3),
  ];

  const total = allNeedingWork.length;
  if (total === 0) return Response.json({ total: 0, updated: 0 });

  // Get ingredients for each recipe
  let updated = 0;
  const batchSize = 5;
  const t0 = Date.now();

  for (let i = 0; i < allNeedingWork.length; i += batchSize) {
    const batch = allNeedingWork.slice(i, i + batchSize);

    for (const recipe of batch) {
      try {
        const { data: ings } = await db.from('recipe_ingredients').select('ingredient').eq('recipe_id', recipe.id).limit(10);
        const ingList = (ings ?? []).map((i: any) => i.ingredient).join(', ');

        const prompt = `${TAG_PROMPT}\n\nTitle: ${recipe.title}\nDescription: ${recipe.description ?? ''}\nIngredients: ${ingList}`;
        const text = await callClaude({ prompt, maxTokens: 300 });
        const result = extractJSON(text) as any;

        const updates: any = {};
        if ((!recipe.cuisine || recipe.cuisine === '') && result.cuisine) updates.cuisine = result.cuisine;
        if ((!recipe.course || recipe.course === '') && result.course) {
          const course = Array.isArray(result.course) ? result.course[0] : result.course;
          updates.course = course?.toLowerCase();
        }
        if (result.tags?.length) {
          const existing = recipe.tags ?? [];
          const newTags = result.tags.map((t: string) => t.toLowerCase().trim()).filter((t: string) => !existing.includes(t));

          // Moderate tags at import time (blocking)
          const cleanTags: string[] = [];
          for (const tag of newTags) {
            try {
              const modResult = await moderateTag(tag);
              await logAiCall({
                userId: user?.id ?? null,
                action: 'moderate_tag',
                model: 'haiku',
                recipeId: recipe.id,
                success: true,
              });
              if (modResult.verdict === 'clean') {
                cleanTags.push(tag);
              }
            } catch {
              // On moderation failure, allow the tag
              cleanTags.push(tag);
            }
          }

          if (cleanTags.length > 0) updates.tags = [...existing, ...cleanTags];
        }

        if (Object.keys(updates).length > 0) {
          await db.from('recipes').update(updates).eq('id', recipe.id);
          updated++;
        }
      } catch {}
    }

    // Small delay between batches
    if (i + batchSize < allNeedingWork.length) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  const u = consumeLastUsage();
  logAiCall({ userId: user?.id ?? null, action: 'suggest_tags', model: 'haiku', durationMs: Date.now() - t0, tokensIn: u?.inputTokens, tokensOut: u?.outputTokens, success: true }).catch(() => {});

  return Response.json({ total, updated });
}

// GET to check how many need tagging
export async function GET(req: Request) {
  const db = getServiceClient();
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: { user } } = await db.auth.getUser(authHeader.slice(7));
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { count } = await db.from('recipes').select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .or('cuisine.is.null,cuisine.eq.,course.is.null,course.eq.');

  return Response.json({ needsTagging: count ?? 0 });
}
