// TODO(web): replicate multi-page scan support (mobile sends up to 5 page images in single Claude Vision call)
// TODO(web): show "Add cover photo?" prompt after import when no image returned
import { importFromUrl, stripHtml, classifyContent, importTechnique, extractJsonLdRecipe, checkJsonLdCompleteness } from '@chefsbook/ai';
import type { ImportCompleteness } from '@chefsbook/ai';
import { supabaseAdmin } from '@chefsbook/db';
import { preflightUrl, fetchWithFallback, ensureTitle } from '../_utils';

function extractImageUrl(html: string, pageUrl: string): string | null {
  const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  if (ogMatch?.[1]) return resolveUrl(ogMatch[1], pageUrl);
  const schemaMatch = html.match(/"image"\s*:\s*"([^"]+)"/);
  if (schemaMatch?.[1] && schemaMatch[1].startsWith('http')) return schemaMatch[1];
  const schemaArrayMatch = html.match(/"image"\s*:\s*\[\s*"([^"]+)"/);
  if (schemaArrayMatch?.[1] && schemaArrayMatch[1].startsWith('http')) return schemaArrayMatch[1];
  return null;
}

function resolveUrl(src: string, base: string): string {
  try { return new URL(src, base).href; } catch { return src; }
}

export async function POST(req: Request) {
  const { url, forceType } = await req.json();

  if (!url || typeof url !== 'string') {
    return Response.json({ error: 'URL is required' }, { status: 400 });
  }

  const preflight = preflightUrl(url);
  if (!preflight.ok) {
    return Response.json({ error: preflight.error }, { status: 422 });
  }

  try {
    const { html: rawHtml } = await fetchWithFallback(url);
    const imageUrl = extractImageUrl(rawHtml, url);
    const text = stripHtml(rawHtml).slice(0, 25000);

    if (text.length < 500) {
      return Response.json(
        { error: 'This site requires a browser to load. Try the Chrome extension instead.' },
        { status: 422 },
      );
    }

    // Classify content: recipe or technique
    const contentType = forceType ?? (await classifyContent(text.slice(0, 1000), url)).content_type;

    if (contentType === 'technique') {
      const technique = await importTechnique(text, url);
      if (!technique) {
        return Response.json({ error: 'Could not extract a technique from this page.' }, { status: 422 });
      }
      return Response.json({ contentType: 'technique', technique, imageUrl });
    }

    // ── Recipe extraction: JSON-LD first, Claude as fallback ──

    const jsonLd = extractJsonLdRecipe(rawHtml);
    const { complete, available, missing } = checkJsonLdCompleteness(jsonLd);

    let recipe: any;
    let completeness: ImportCompleteness;

    if (complete && jsonLd) {
      // JSON-LD has title + ingredients with quantities + steps → use directly, skip Claude
      recipe = { ...jsonLd, source_type: 'url' };
      completeness = { source: 'json-ld', complete: true, missing_fields: missing };
    } else if (jsonLd && available.length > 0) {
      // Partial JSON-LD → ask Claude to fill gaps only
      const jsonLdSummary = JSON.stringify(jsonLd, null, 2).slice(0, 3000);
      recipe = await importFromUrl(text, url, {
        available,
        missing,
        jsonLdData: jsonLdSummary,
      });
      // Merge: prefer JSON-LD for fields it had
      if (jsonLd.title && !recipe.title) recipe.title = jsonLd.title;
      if (jsonLd.ingredients?.length && available.includes('ingredients')) recipe.ingredients = jsonLd.ingredients;
      if (jsonLd.steps?.length && available.includes('steps')) recipe.steps = jsonLd.steps;
      if (jsonLd.servings && !recipe.servings) recipe.servings = jsonLd.servings;
      if (jsonLd.prep_minutes && !recipe.prep_minutes) recipe.prep_minutes = jsonLd.prep_minutes;
      if (jsonLd.cook_minutes && !recipe.cook_minutes) recipe.cook_minutes = jsonLd.cook_minutes;
      completeness = { source: 'json-ld+claude', complete: !missing.some((f) => ['title', 'ingredients', 'steps'].includes(f)), missing_fields: missing };
    } else {
      // No JSON-LD at all → full Claude extraction with 25k limit
      recipe = await importFromUrl(text, url);
      const hasIngredients = recipe.ingredients?.length > 0;
      const hasSteps = recipe.steps?.length > 0;
      completeness = {
        source: 'claude',
        complete: !!recipe.title && hasIngredients && hasSteps,
        missing_fields: [
          ...(!recipe.title ? ['title'] : []),
          ...(!hasIngredients ? ['ingredients'] : []),
          ...(!hasSteps ? ['steps'] : []),
        ],
      };
    }

    const { title, generated } = ensureTitle(recipe, url);
    recipe.title = title;

    // Tag incomplete recipes
    if (!completeness.complete || generated) {
      recipe.tags = [...(recipe.tags ?? []), '_incomplete'];
    }

    // Track import site stats (fire and forget)
    try {
      const domain = new URL(url).hostname.replace(/^www\./, '');
      const success = completeness.complete;
      const autoStatus = success ? 'working' : 'partial';
      // Upsert: increment attempts, conditionally increment successes
      const { data: existing } = await supabaseAdmin.from('import_site_tracker').select('id, total_attempts, successful_attempts').eq('domain', domain).maybeSingle();
      if (existing) {
        const newTotal = (existing.total_attempts ?? 0) + 1;
        const newSuccess = (existing.successful_attempts ?? 0) + (success ? 1 : 0);
        const rate = newSuccess / newTotal;
        const calcStatus = rate > 0.8 ? 'working' : rate >= 0.2 ? 'partial' : 'broken';
        await supabaseAdmin.from('import_site_tracker').update({
          total_attempts: newTotal, successful_attempts: newSuccess,
          last_import_at: new Date().toISOString(), status: calcStatus, updated_at: new Date().toISOString(),
        }).eq('id', existing.id);
      } else {
        await supabaseAdmin.from('import_site_tracker').insert({
          domain, total_attempts: 1, successful_attempts: success ? 1 : 0,
          last_import_at: new Date().toISOString(), status: autoStatus,
        });
      }
    } catch { /* non-critical — don't block import */ }

    return Response.json({
      contentType: 'recipe',
      recipe,
      imageUrl,
      titleGenerated: generated,
      completeness,
    });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
