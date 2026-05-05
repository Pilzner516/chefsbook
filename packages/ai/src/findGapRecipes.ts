import { supabaseAdmin } from '@chefsbook/db';
import { callClaude, HAIKU } from './client';

export interface GapRecipeCandidate {
  url: string;
  title: string;
  source_domain: string;
  quality_rating: number | null;
  confidence: 'high' | 'medium' | 'low';
}

interface SearchResult {
  url: string;
  title: string;
  domain: string;
}

/**
 * Scrape Google search results to extract recipe URLs.
 * Uses a simple HTTP fetch + HTML parsing approach.
 */
async function scrapeGoogleSearch(query: string, siteDomain?: string): Promise<SearchResult[]> {
  const searchQuery = siteDomain ? `${query} site:${siteDomain}` : query;
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}&num=10`;

  try {
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!response.ok) {
      console.warn(`Google search failed: ${response.status}`);
      return [];
    }

    const html = await response.text();

    // Use Claude to extract URLs and titles from the search results HTML
    const prompt = `Extract recipe URLs from this Google search results HTML. Return only actual recipe pages (not search pages, category pages, or blog homepages).

For each recipe URL found, provide:
- url: the direct recipe page URL
- title: the page title
- domain: the domain name (e.g., "bonappetit.com")

Return as JSON array:
[{"url": "https://...", "title": "...", "domain": "..."}]

HTML excerpt (first 15000 chars):
${html.slice(0, 15000)}`;

    const claudeResponse = await callClaude({
      prompt,
      model: HAIKU,
      maxTokens: 2000,
    });

    // Extract JSON from response
    const jsonMatch = claudeResponse.match(/```json\s*([\s\S]*?)```/) ?? claudeResponse.match(/(\[[\s\S]*\])/);
    if (!jsonMatch) {
      console.warn('No JSON found in Claude response for URL extraction');
      return [];
    }

    const results = JSON.parse(jsonMatch[1] ?? jsonMatch[0]);
    return Array.isArray(results) ? results.slice(0, 5) : [];
  } catch (error) {
    console.error('Google search scraping failed:', error);
    return [];
  }
}

/**
 * Find recipe URLs to fill a knowledge gap using web search.
 *
 * Strategy:
 * 1. Get high-quality recipe sites from import_site_tracker
 * 2. Scrape Google search results for each site
 * 3. Use Claude to extract actual recipe URLs from HTML
 * 4. Check which URLs aren't already in the recipes table
 * 5. Return top 5 candidates
 */
export async function findGapRecipes(
  technique: string,
  ingredientCategory: string | null
): Promise<GapRecipeCandidate[]> {
  const candidates: GapRecipeCandidate[] = [];

  // Step 1: Get high-quality recipe sites (rating >= 4)
  const { data: sites } = await supabaseAdmin
    .from('import_site_tracker')
    .select('domain, rating')
    .gte('rating', 4)
    .eq('status', 'working')
    .order('rating', { ascending: false })
    .limit(5);

  const fallbackDomains = [
    'seriouseats.com',
    'bonappetit.com',
    'smittenkitchen.com',
    'kingarthurbaking.com',
    'cookieandkate.com',
  ];

  const targetDomains = sites && sites.length > 0
    ? sites.map(s => ({ domain: s.domain, rating: s.rating }))
    : fallbackDomains.map(d => ({ domain: d, rating: 5 }));

  // Step 2: Construct search query
  const ingredient = ingredientCategory ? ` ${ingredientCategory}` : '';
  const baseQuery = `${technique}${ingredient} recipe`;

  // Step 3: Scrape Google for each target domain
  const allResults: (SearchResult & { rating: number })[] = [];

  for (const site of targetDomains.slice(0, 3)) {
    const results = await scrapeGoogleSearch(baseQuery, site.domain);

    for (const result of results) {
      allResults.push({ ...result, rating: site.rating });
    }

    // Delay between searches to be respectful to Google
    if (site !== targetDomains[2]) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Step 4: Check which URLs aren't already imported
  const urls = allResults.map(r => r.url);
  const { data: existing } = await supabaseAdmin
    .from('recipes')
    .select('source_url')
    .in('source_url', urls);

  const existingUrls = new Set((existing || []).map(r => r.source_url));

  // Step 5: Build candidates from new URLs
  for (const result of allResults) {
    if (existingUrls.has(result.url)) {
      continue; // Skip already imported recipes
    }

    candidates.push({
      url: result.url,
      title: result.title,
      source_domain: result.domain,
      quality_rating: result.rating,
      confidence: result.rating >= 4 ? 'high' : 'medium',
    });
  }

  // Step 6: Sort by quality and return top 5
  return candidates
    .sort((a, b) => {
      // Sort by quality rating first, then confidence
      if (a.quality_rating !== b.quality_rating) {
        return (b.quality_rating || 0) - (a.quality_rating || 0);
      }
      const confOrder = { high: 3, medium: 2, low: 1 };
      return confOrder[b.confidence] - confOrder[a.confidence];
    })
    .slice(0, 5);
}
