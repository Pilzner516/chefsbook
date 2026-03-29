import { createClient } from '@supabase/supabase-js';
import { importFromUrl, stripHtml } from '@chefsbook/ai';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  return createClient(url, serviceKey);
}

function extractImageUrl(html: string, pageUrl: string): string | null {
  const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  if (ogMatch?.[1]) { try { return new URL(ogMatch[1], pageUrl).href; } catch { return ogMatch[1]; } }
  const schemaMatch = html.match(/"image"\s*:\s*"([^"]+)"/);
  if (schemaMatch?.[1]?.startsWith('http')) return schemaMatch[1];
  return null;
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function POST(req: Request) {
  const headers = corsHeaders();
  const db = getServiceClient();

  // Auth
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers });
  }
  const { data: { user }, error: authError } = await db.auth.getUser(authHeader.slice(7));
  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers });
  }

  const { url, html: clientHtml } = await req.json();
  if (!url || typeof url !== 'string') {
    return Response.json({ error: 'URL is required' }, { status: 400, headers });
  }

  try {
    let rawHtml: string;

    if (clientHtml && typeof clientHtml === 'string' && clientHtml.length > 100) {
      // Extension sent page HTML directly (bypasses Cloudflare etc.)
      rawHtml = clientHtml;
    } else {
      // Fallback: fetch server-side
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36' },
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) {
        return Response.json({ error: `Failed to fetch: ${response.status}` }, { status: 502, headers });
      }
      rawHtml = await response.text();
    }

    const imageUrl = extractImageUrl(rawHtml, url);
    const text = stripHtml(rawHtml).slice(0, 10000);

    if (text.length < 100) {
      return Response.json({ error: 'Page has no meaningful content' }, { status: 422, headers });
    }

    // AI extraction
    const recipe = await importFromUrl(text, url);

    // Save to DB
    const { data: newRecipe, error: insertErr } = await db
      .from('recipes')
      .insert({
        user_id: user.id,
        title: recipe.title,
        description: recipe.description,
        servings: recipe.servings ?? 4,
        prep_minutes: recipe.prep_minutes,
        cook_minutes: recipe.cook_minutes,
        cuisine: recipe.cuisine,
        course: recipe.course,
        source_type: 'url',
        source_url: url,
        image_url: imageUrl,
        notes: recipe.notes,
      })
      .select()
      .single();

    if (insertErr || !newRecipe) {
      return Response.json({ error: insertErr?.message ?? 'Insert failed' }, { status: 500, headers });
    }

    // Insert ingredients + steps
    if (recipe.ingredients?.length) {
      await db.from('recipe_ingredients').insert(
        recipe.ingredients.map((ing: any, i: number) => ({
          recipe_id: newRecipe.id,
          user_id: user.id,
          sort_order: i,
          quantity: ing.quantity,
          unit: ing.unit,
          ingredient: ing.ingredient,
          preparation: ing.preparation,
          optional: ing.optional,
          group_label: ing.group_label,
        })),
      );
    }
    if (recipe.steps?.length) {
      await db.from('recipe_steps').insert(
        recipe.steps.map((step: any) => ({
          recipe_id: newRecipe.id,
          user_id: user.id,
          step_number: step.step_number,
          instruction: step.instruction,
          timer_minutes: step.timer_minutes,
          group_label: step.group_label,
        })),
      );
    }

    return Response.json({
      success: true,
      recipe: { id: newRecipe.id, title: newRecipe.title },
    }, { headers });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500, headers });
  }
}
