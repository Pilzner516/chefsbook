import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin, checkRecipeCompleteness } from '@chefsbook/db';
import { KNOWN_RECIPE_SITES } from '@chefsbook/ai';
import { preflightUrl, fetchWithFallback } from '../../import/_utils';
import { importFromUrl, stripHtml, extractJsonLdRecipe, checkJsonLdCompleteness } from '@chefsbook/ai';

async function verifyAdmin(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return null;
  const { data } = await supabaseAdmin.from('admin_users').select('role').eq('user_id', user.id).single();
  return data ? user.id : null;
}

interface SiteTestResult {
  domain: string;
  testUrl: string;
  success: boolean;
  rating: number;
  missingFields: string[];
  failureReason: string | null;
  durationMs: number;
}

async function testOneSite(domain: string, testUrl: string): Promise<SiteTestResult> {
  const started = Date.now();
  try {
    const preflight = preflightUrl(testUrl);
    if (!preflight.ok) {
      return { domain, testUrl, success: false, rating: 1, missingFields: ['url_invalid'], failureReason: preflight.error ?? 'preflight failed', durationMs: Date.now() - started };
    }
    const { html } = await fetchWithFallback(testUrl);
    const text = stripHtml(html).slice(0, 25000);
    const jsonLd = extractJsonLdRecipe(html);
    const ck = checkJsonLdCompleteness(jsonLd);
    let recipe: any;
    if (ck.complete && jsonLd) {
      recipe = jsonLd;
    } else {
      recipe = await importFromUrl(text, testUrl);
    }
    const completeness = checkRecipeCompleteness({
      title: recipe?.title,
      description: recipe?.description,
      ingredients: recipe?.ingredients ?? [],
      steps: recipe?.steps ?? [],
      tags: recipe?.tags ?? [],
    });
    const missing = completeness.missingFields.length;
    const rating = missing === 0 ? 5 : missing === 1 ? 4 : missing === 2 ? 3 : missing === 3 ? 2 : 1;
    return {
      domain, testUrl,
      success: completeness.isComplete,
      rating,
      missingFields: completeness.missingFields,
      failureReason: completeness.isComplete ? null : completeness.missingFields.join(', '),
      durationMs: Date.now() - started,
    };
  } catch (e: unknown) {
    return { domain, testUrl, success: false, rating: 1, missingFields: [], failureReason: e instanceof Error ? e.message : 'unknown', durationMs: Date.now() - started };
  }
}

export async function POST(req: NextRequest) {
  const adminId = await verifyAdmin(req);
  const isCron = req.headers.get('x-cron-secret') === process.env.CRON_SECRET;
  if (!adminId && !isCron) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const domains: string[] | undefined = body.domains;
  const ratings: (number | null)[] | undefined = body.ratings;

  let sites: typeof KNOWN_RECIPE_SITES;
  if (domains) {
    sites = KNOWN_RECIPE_SITES.filter((s) => domains.includes(s.domain));
  } else if (ratings && ratings.length > 0) {
    // Filter by rating tiers from import_site_tracker
    const numericRatings = ratings.filter((r): r is number => r !== null);
    const includeNull = ratings.includes(null);
    let matchedDomains: string[] = [];

    if (numericRatings.length > 0 && includeNull) {
      const { data: byRating } = await supabaseAdmin
        .from('import_site_tracker')
        .select('domain')
        .in('rating', numericRatings);
      const { data: byNull } = await supabaseAdmin
        .from('import_site_tracker')
        .select('domain')
        .is('rating', null);
      matchedDomains = [...(byRating ?? []), ...(byNull ?? [])].map((r) => r.domain);
    } else if (numericRatings.length > 0) {
      const { data } = await supabaseAdmin
        .from('import_site_tracker')
        .select('domain')
        .in('rating', numericRatings);
      matchedDomains = (data ?? []).map((r) => r.domain);
    } else if (includeNull) {
      const { data } = await supabaseAdmin
        .from('import_site_tracker')
        .select('domain')
        .is('rating', null);
      matchedDomains = (data ?? []).map((r) => r.domain);
    }

    const domainSet = new Set(matchedDomains);
    sites = KNOWN_RECIPE_SITES.filter((s) => domainSet.has(s.domain));
  } else {
    sites = KNOWN_RECIPE_SITES;
  }

  const results: SiteTestResult[] = [];
  for (const site of sites) {
    const result = await testOneSite(site.domain, site.testUrl);
    results.push(result);
    // Update tracker
    const { data: existing } = await supabaseAdmin
      .from('import_site_tracker')
      .select('id')
      .eq('domain', site.domain)
      .maybeSingle();
    const update: any = {
      rating: result.rating,
      last_auto_tested_at: new Date().toISOString(),
      status: result.rating >= 4 ? 'working' : result.rating >= 3 ? 'partial' : 'broken',
    };
    if (existing) {
      await supabaseAdmin.from('import_site_tracker').update(update).eq('id', existing.id);
    } else {
      await supabaseAdmin.from('import_site_tracker').insert({ domain: site.domain, ...update });
    }
    await new Promise((r) => setTimeout(r, 3000)); // rate-limit 1/3s
  }

  const summary = {
    tested: results.length,
    passed: results.filter((r) => r.rating >= 4).length,
    failed: results.filter((r) => r.rating <= 2).length,
    results,
  };

  await supabaseAdmin
    .from('scheduled_jobs')
    .update({
      last_run_at: new Date().toISOString(),
      last_run_status: 'success',
      last_run_result: summary,
    })
    .eq('job_name', 'site_compatibility_test');

  return NextResponse.json(summary);
}
