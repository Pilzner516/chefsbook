import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin, logImportAttempt } from '@chefsbook/db';
import { KNOWN_RECIPE_SITES } from '@chefsbook/ai';

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
  rating: number | null;
  needsExtension: boolean;
  fetchMethod: string;
  ingredientCount: number;
  stepCount: number;
  hasQuantities: boolean;
  missingFields: string[];
  failureReason: string | null;
  durationMs: number;
}

/**
 * Run the FULL import pipeline for a site (same as a real user import).
 * Uses the internal localhost endpoint to avoid Cloudflare loopback.
 */
async function testOneSite(domain: string, testUrl: string): Promise<SiteTestResult> {
  const started = Date.now();
  try {
    const res = await fetch('http://localhost:3000/api/import/url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: testUrl, userLanguage: 'en' }),
    });

    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      return {
        domain, testUrl, success: false, rating: 1, needsExtension: false,
        fetchMethod: 'error', ingredientCount: 0, stepCount: 0, hasQuantities: false,
        missingFields: [], failureReason: `Non-JSON response (${res.status})`,
        durationMs: Date.now() - started,
      };
    }

    const body = await res.json();

    // Check for blocked/extension-required
    if (body.needsBrowserExtraction && !body.recipe) {
      return {
        domain, testUrl, success: false, rating: null, needsExtension: true,
        fetchMethod: body.reason ?? 'fetch_blocked', ingredientCount: 0, stepCount: 0,
        hasQuantities: false, missingFields: [], failureReason: body.reason ?? 'blocked',
        durationMs: Date.now() - started,
      };
    }

    if (body.error && !body.recipe) {
      return {
        domain, testUrl, success: false, rating: 1, needsExtension: false,
        fetchMethod: 'error', ingredientCount: 0, stepCount: 0, hasQuantities: false,
        missingFields: [], failureReason: String(body.error).slice(0, 200),
        durationMs: Date.now() - started,
      };
    }

    const recipe = body.recipe ?? {};
    const ingredients = recipe.ingredients ?? [];
    const steps = recipe.steps ?? [];
    const withQty = ingredients.filter((i: any) => i.quantity != null && i.unit).length;
    const hasDesc = !!recipe.description;
    const hasTitle = !!recipe.title;

    // Determine missing fields
    const missing: string[] = [];
    if (!hasTitle) missing.push('title');
    if (!hasDesc) missing.push('description');
    if (ingredients.length < 2) missing.push('ingredients');
    if (steps.length < 1) missing.push('steps');

    // Rating based on actual content quality
    let rating: number | null;
    if (body.needsBrowserExtraction) {
      // Partial result but extension could do better
      rating = missing.length <= 1 ? 3 : missing.length <= 2 ? 2 : 1;
    } else if (ingredients.length >= 3 && withQty >= 3 && steps.length >= 2 && hasDesc) {
      rating = 5;
    } else if (ingredients.length >= 2 && steps.length >= 1) {
      rating = 4;
    } else if (ingredients.length >= 1 || steps.length >= 1) {
      rating = 3;
    } else if (hasDesc) {
      rating = 2;
    } else if (hasTitle) {
      rating = 1;
    } else {
      rating = 1;
    }

    const fetchMethod = body.completeness?.source ?? 'unknown';
    const complete = missing.length === 0;

    return {
      domain, testUrl,
      success: complete,
      rating,
      needsExtension: !!body.needsBrowserExtraction,
      fetchMethod,
      ingredientCount: ingredients.length,
      stepCount: steps.length,
      hasQuantities: withQty > 0,
      missingFields: missing,
      failureReason: complete ? null : missing.join(', '),
      durationMs: Date.now() - started,
    };
  } catch (e: unknown) {
    return {
      domain, testUrl, success: false, rating: 1, needsExtension: false,
      fetchMethod: 'exception', ingredientCount: 0, stepCount: 0, hasQuantities: false,
      missingFields: [], failureReason: e instanceof Error ? e.message : 'unknown',
      durationMs: Date.now() - started,
    };
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
    const numericRatings = ratings.filter((r): r is number => r !== null);
    const includeNull = ratings.includes(null);
    let matchedDomains: string[] = [];

    if (numericRatings.length > 0) {
      const { data } = await supabaseAdmin.from('import_site_tracker').select('domain').in('rating', numericRatings);
      matchedDomains = (data ?? []).map((r) => r.domain);
    }
    if (includeNull) {
      const { data } = await supabaseAdmin.from('import_site_tracker').select('domain').is('rating', null);
      matchedDomains = [...matchedDomains, ...(data ?? []).map((r) => r.domain)];
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

    // Log attempt + recalculate rating from aggregate
    try {
      await logImportAttempt({
        userId: adminId,
        url: site.testUrl,
        domain: site.domain,
        success: result.success,
        failureReason: result.failureReason,
      });
    } catch { /* non-critical */ }

    // Update last_auto_tested_at
    await supabaseAdmin.from('import_site_tracker')
      .update({ last_auto_tested_at: new Date().toISOString() })
      .eq('domain', site.domain);

    // Log to site_test_runs
    try {
      await supabaseAdmin.from('site_test_runs').insert({
        domain: site.domain,
        test_url: site.testUrl,
        rating: result.rating,
        needs_extension: result.needsExtension,
        fetch_method: result.fetchMethod,
        ingredient_count: result.ingredientCount,
        step_count: result.stepCount,
        has_quantities: result.hasQuantities,
        error_reason: result.failureReason,
        triggered_by: adminId,
      });
    } catch { /* non-critical */ }

    await new Promise((r) => setTimeout(r, 3000));
  }

  // Build summary with category breakdown
  const byCategory = {
    full: results.filter((r) => r.rating === 5),
    good: results.filter((r) => r.rating === 4),
    partial: results.filter((r) => r.rating === 3),
    titleOnly: results.filter((r) => r.rating !== null && r.rating <= 2),
    needsExtension: results.filter((r) => r.needsExtension && r.rating === null),
    failed: results.filter((r) => !r.needsExtension && r.rating !== null && r.rating <= 1 && !r.success),
  };

  const summary = {
    tested: results.length,
    passed: results.filter((r) => r.rating !== null && r.rating >= 4).length,
    failed: results.filter((r) => r.rating !== null && r.rating <= 2).length,
    needsExtension: results.filter((r) => r.needsExtension).length,
    categories: {
      full: byCategory.full.length,
      good: byCategory.good.length,
      partial: byCategory.partial.length,
      titleOnly: byCategory.titleOnly.length,
      needsExtension: byCategory.needsExtension.length,
      failed: byCategory.failed.length,
    },
    results,
  };

  await supabaseAdmin
    .from('scheduled_jobs')
    .update({
      last_run_at: new Date().toISOString(),
      last_run_status: 'success',
      last_run_result: { tested: summary.tested, passed: summary.passed, failed: summary.failed, needsExtension: summary.needsExtension },
    })
    .eq('job_name', 'site_compatibility_test');

  return NextResponse.json(summary);
}
