import { supabaseAdmin } from '@chefsbook/db';
import { callClaude } from './client';
import { KNOWN_RECIPE_SITES } from './siteList';

export interface GapRecipeCandidate {
  url: string;
  title: string;
  source_domain: string;
  quality_rating: number | null;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Find recipe URLs to fill a knowledge gap using AI-guided search.
 *
 * Strategy:
 * 1. Get high-quality recipe sites from import_site_tracker
 * 2. Use Claude to generate search queries for the technique+ingredient
 * 3. Construct search URLs for top sites
 * 4. Check which URLs aren't already in the recipes table
 * 5. Return top 5 candidates
 *
 * Note: This is a simplified implementation. A full version would use
 * a web search API (Google Custom Search, Bing, etc.) to find actual URLs.
 * For now, we construct likely URLs based on site patterns.
 */
export async function findGapRecipes(
  technique: string,
  ingredientCategory: string | null
): Promise<GapRecipeCandidate[]> {
  const candidates: GapRecipeCandidate[] = [];

  // Step 1: Get high-quality recipe sites (rating >= 4)
  const { data: sites } = await supabaseAdmin
    .from('import_site_tracker')
    .select('domain, rating, status')
    .gte('rating', 4)
    .eq('status', 'working')
    .order('rating', { ascending: false })
    .limit(10);

  if (!sites || sites.length === 0) {
    // Fallback to known high-quality sites
    const fallbackDomains = [
      'seriouseats.com',
      'bonappetit.com',
      'smittenkitchen.com',
      'kingarthurbaking.com',
      'cookieandkate.com',
    ];

    for (const domain of fallbackDomains) {
      candidates.push({
        url: `https://${domain}/search?q=${encodeURIComponent(technique + (ingredientCategory ? ' ' + ingredientCategory : ''))}`,
        title: `Search results for ${technique} ${ingredientCategory || ''}`,
        source_domain: domain,
        quality_rating: 5,
        confidence: 'medium',
      });
    }
  } else {
    // Step 2: Use Claude to generate likely recipe titles/URLs
    const ingredient = ingredientCategory ? ` with ${ingredientCategory}` : '';
    const prompt = `Given the cooking technique "${technique}"${ingredient}, suggest 3 likely recipe titles that would teach someone this technique well. Format as JSON array of strings. Be specific and realistic - these should sound like actual recipe titles from cooking blogs.

Example format:
["Perfect Pan-Seared Chicken Breast", "Crispy Roasted Chicken Thighs", "One-Pan Chicken Dinner"]`;

    try {
      const response = await callClaude({
        prompt,
        model: 'claude-haiku-4-5-20251001',
        maxTokens: 500,
      });

      const recipeTitles = JSON.parse(response);

      // Step 3: Construct search URLs for each site + recipe title combo
      for (const site of sites.slice(0, 5)) {
        for (const title of recipeTitles.slice(0, 2)) {
          const searchQuery = `${title} site:${site.domain}`;
          candidates.push({
            url: `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`,
            title: title,
            source_domain: site.domain,
            quality_rating: site.rating,
            confidence: 'high',
          });
        }
      }
    } catch (error) {
      console.error('Failed to generate recipe titles:', error);
      // Fallback to simple search URLs
      for (const site of sites.slice(0, 5)) {
        const searchQuery = `${technique}${ingredient}`;
        candidates.push({
          url: `https://www.google.com/search?q=${encodeURIComponent(searchQuery + ' site:' + site.domain)}`,
          title: `${technique}${ingredient} recipe`,
          source_domain: site.domain,
          quality_rating: site.rating,
          confidence: 'low',
        });
      }
    }
  }

  // Step 4: Check which URLs aren't already imported
  // Note: We're returning Google search URLs, not direct recipe URLs,
  // so this check is less relevant. In a full implementation, we'd
  // fetch the actual recipe URLs from search results.

  // Step 5: Return top 5 candidates
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

/**
 * TODO: Full implementation would:
 * 1. Use Google Custom Search API or Bing Web Search API
 * 2. Execute actual searches for "technique + ingredient + recipe"
 * 3. Filter results to known high-quality recipe domains
 * 4. Extract recipe URLs from search results
 * 5. Check each URL against recipes.source_url_normalized
 * 6. Return only URLs that haven't been imported yet
 *
 * Cost: ~$0.005 per search (Google Custom Search) + $0.001 (Claude Haiku)
 * Total: ~$0.01 per gap
 */
