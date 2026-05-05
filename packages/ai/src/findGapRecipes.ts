import { supabaseAdmin } from '@chefsbook/db';
import { getApiKey } from './client';

export interface GapRecipeCandidate {
  url: string;
  title: string;
  source_domain: string;
  quality_rating: number | null;
  confidence: 'high' | 'medium' | 'low';
}

const TARGET_SITES = [
  'seriouseats.com',
  'bonappetit.com',
  'smittenkitchen.com',
  'davidlebovitz.com',
  'kingarthurbaking.com',
  'cookieandkate.com',
];

const API_URL = 'https://api.anthropic.com/v1/messages';

/**
 * Find real recipe URLs to fill a knowledge gap using Anthropic's web_search tool.
 * Claude searches the web server-side — no Google HTML scraping.
 */
export async function findGapRecipes(
  technique: string,
  ingredientCategory: string | null
): Promise<GapRecipeCandidate[]> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('Claude API key not found. Set ANTHROPIC_API_KEY or EXPO_PUBLIC_ANTHROPIC_API_KEY.');
  }

  const ingredient = ingredientCategory ? ` ${ingredientCategory}` : '';
  const topic = `${technique}${ingredient}`;
  const siteList = TARGET_SITES.join(', ');

  const prompt = `Search for real recipe pages about "${topic} recipe" on high-quality cooking sites.

Focus on these sites: ${siteList}

Find 5–7 DIRECT recipe page URLs (not homepages, category listing pages, or search pages). Each URL must be a specific individual recipe.

Return ONLY a JSON array, no other text:
[
  {"url": "https://www.seriouseats.com/specific-recipe-slug", "title": "Recipe Title", "domain": "seriouseats.com"},
  ...
]`;

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error('[findGapRecipes] Anthropic API error:', response.status, errorText);
      return [];
    }

    const data = await response.json();

    // Collect text from all text-type content blocks (Claude may emit multiple)
    const textParts: string[] = [];
    for (const block of data.content ?? []) {
      if (block.type === 'text') {
        textParts.push(block.text);
      }
    }
    const fullText = textParts.join('\n');

    if (!fullText.trim()) {
      console.warn('[findGapRecipes] Empty text response from web search');
      return [];
    }

    const jsonMatch =
      fullText.match(/```json\s*([\s\S]*?)```/) ??
      fullText.match(/(\[[\s\S]*\])/);

    if (!jsonMatch) {
      console.warn('[findGapRecipes] No JSON array found in response:', fullText.slice(0, 500));
      return [];
    }

    let results: Array<{ url: string; title: string; domain: string }>;
    try {
      results = JSON.parse(jsonMatch[1] ?? jsonMatch[0]);
    } catch {
      console.warn('[findGapRecipes] JSON parse failed for:', (jsonMatch[1] ?? jsonMatch[0]).slice(0, 200));
      return [];
    }

    if (!Array.isArray(results) || results.length === 0) return [];

    // Filter out URLs already in the recipes table
    const urls = results.map(r => r.url).filter(Boolean);
    const { data: existing } = await supabaseAdmin
      .from('recipes')
      .select('source_url_normalized')
      .in('source_url_normalized', urls);

    const existingUrls = new Set(
      (existing ?? []).map((r: { source_url_normalized: string }) => r.source_url_normalized).filter(Boolean)
    );

    return results
      .filter(r => r.url && !existingUrls.has(r.url))
      .map(r => {
        let domain = r.domain;
        if (!domain) {
          try { domain = new URL(r.url).hostname.replace('www.', ''); } catch { domain = ''; }
        }
        return {
          url: r.url,
          title: r.title ?? '',
          source_domain: domain,
          quality_rating: 5,
          confidence: 'high' as const,
        };
      })
      .slice(0, 5);
  } catch (error) {
    console.error('[findGapRecipes] Failed:', error);
    return [];
  }
}
