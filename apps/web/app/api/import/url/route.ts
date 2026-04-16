// TODO(web): replicate multi-page scan support (mobile sends up to 5 page images in single Claude Vision call)
// TODO(web): show "Add cover photo?" prompt after import when no image returned
import { importFromUrl, stripHtml, classifyContent, importTechnique, extractJsonLdRecipe, checkJsonLdCompleteness, detectLanguage, translateRecipeContent } from '@chefsbook/ai';
import type { ImportCompleteness } from '@chefsbook/ai';
import { supabaseAdmin, getSiteBlockStatus, extractDomain, recordSiteDiscovery, logImportAttempt } from '@chefsbook/db';
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
  const { url, forceType, userLanguage: reqLang } = await req.json();

  if (!url || typeof url !== 'string') {
    return Response.json({ error: 'URL is required' }, { status: 400 });
  }

  const preflight = preflightUrl(url);
  if (!preflight.ok) {
    return Response.json({ error: preflight.error }, { status: 422 });
  }

  const domain = extractDomain(url);
  const siteStatus = await getSiteBlockStatus(domain).catch(() => null);
  // Detect a first-time domain BEFORE anything else writes to import_site_tracker.
  const discovery = await recordSiteDiscovery(domain, null).catch(() => ({ isNewDiscovery: false, discoveryCount: 0 }));
  if (siteStatus?.is_blocked) {
    return Response.json({
      error: 'site_blocked',
      message: siteStatus.block_reason
        ? `We're unable to import from ${domain} at this time. ${siteStatus.block_reason}`
        : `Import unavailable from ${domain}. Try copying the recipe text and pasting it, or take a photo of the recipe.`,
      userMessage: true,
    }, { status: 422 });
  }
  const siteWarning = siteStatus?.rating && siteStatus.rating <= 2
    ? "This site has known import issues but don't worry — we'll help you fill any gaps automatically after import."
    : null;

  try {
    const { html: rawHtml } = await fetchWithFallback(url);
    const imageUrl = extractImageUrl(rawHtml, url);
    const text = stripHtml(rawHtml).slice(0, 25000);

    if (text.length < 500) {
      return Response.json(
        {
          error: 'This site requires a browser to load. Try the Chrome extension instead.',
          needsBrowserExtraction: true,
          domain,
          reason: 'too_little_text',
        },
        { status: 206 },
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

    // ── Detect language + translate if needed ──
    const userLanguage = reqLang ?? 'en';
    let sourceLanguage = 'en';
    try {
      const sampleText = `${recipe.title ?? ''} ${(recipe.ingredients ?? []).slice(0, 3).map((i: any) => i.ingredient ?? '').join(' ')} ${(recipe.steps ?? []).slice(0, 1).map((s: any) => s.instruction ?? '').join(' ')}`;
      sourceLanguage = await detectLanguage(sampleText);
      if (sourceLanguage !== userLanguage) {
        recipe = await translateRecipeContent(recipe, userLanguage, sourceLanguage);
      }
    } catch { /* translation failure is non-blocking — keep original */ }
    recipe.source_language = sourceLanguage;
    if (sourceLanguage !== userLanguage) recipe.translated_from = sourceLanguage;

    const { title, generated } = ensureTitle(recipe, url);
    recipe.title = title;

    // Tag incomplete recipes
    if (!completeness.complete || generated) {
      recipe.tags = [...(recipe.tags ?? []), '_incomplete'];
    }

    // Track import site stats + recalculate rating (fire and forget)
    try {
      await logImportAttempt({
        userId: null,
        url,
        domain,
        success: completeness.complete,
        failureReason: completeness.complete ? null : completeness.missing_fields.join(', '),
      });
    } catch { /* non-critical — don't block import */ }

    // ── PDF fallback signal for incomplete results ──
    // If extraction succeeded but the recipe is critically incomplete
    // (missing ingredients OR steps), signal that the extension could do
    // better with browser-rendered HTML. Return the partial recipe AND
    // the fallback signal so the client can hand off to the extension.
    const hasIngredients = (recipe.ingredients?.length ?? 0) >= 1;
    const hasSteps = (recipe.steps?.length ?? 0) >= 1;
    const criticallyIncomplete = !hasIngredients || !hasSteps;
    const needsBrowserFallback = criticallyIncomplete && !!recipe.title;

    return Response.json({
      contentType: 'recipe',
      recipe,
      imageUrl,
      titleGenerated: generated,
      completeness,
      siteWarning,
      // Signal extension fallback when extraction is critically incomplete
      ...(needsBrowserFallback ? {
        needsBrowserExtraction: true,
        reason: 'incomplete_extraction',
        incompleteMessage: `We found the recipe title but couldn't extract the full ${!hasIngredients && !hasSteps ? 'ingredients and steps' : !hasIngredients ? 'ingredients' : 'steps'}. The browser extension can get the complete recipe.`,
      } : {}),
      discovery: discovery.isNewDiscovery
        ? {
            isNew: true,
            domain,
            message: "You've helped ChefsBook discover something new!",
            subMessage: `We hadn't seen ${domain} before. We've added it to our list and we'll test it soon so every future import from this site works beautifully.`,
          }
        : null,
    });
  } catch (e: any) {
    // Fetch-layer failures (403 from Cloudflare, timeouts, DNS, etc.) are the
    // classic signal that the extension's browser-side extraction is needed.
    const msg = String(e?.message ?? e);
    const isBotBlock = /403|460|429|blocked/i.test(msg) || /fetch/i.test(msg);
    if (isBotBlock) {
      return Response.json({
        error: msg,
        needsBrowserExtraction: true,
        domain,
        reason: 'fetch_blocked',
        message: `This site blocks server imports. The ChefsBook browser extension handles it silently.`,
      }, { status: 206 });
    }
    return Response.json({ error: msg }, { status: 500 });
  }
}
