#!/usr/bin/env node
/**
 * Backfill recipe_categories table by analyzing all recipes and assigning categories
 *
 * Critical fix for issue found during slux migration verification:
 * - 371 categories defined in categories table
 * - 0 rows in recipe_categories junction table
 *
 * This script uses AI to suggest 2-6 categories per recipe based on:
 * - Title, description, cuisine, course, tags
 * - First 10 ingredients
 *
 * Usage:
 *   node scripts/backfill-recipe-categories.mjs [--limit N] [--dry-run]
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Missing env vars: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

if (!ANTHROPIC_API_KEY) {
  console.error('❌ Missing env var: ANTHROPIC_API_KEY or EXPO_PUBLIC_ANTHROPIC_API_KEY');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SERVICE_KEY);

/**
 * Call Claude API to suggest categories for a recipe
 */
async function suggestRecipeCategories(recipe, categoryMap) {
  // Group categories by group for better Claude comprehension
  const byGroup = categoryMap.reduce((acc, cat) => {
    if (!acc[cat.group_slug]) acc[cat.group_slug] = [];
    acc[cat.group_slug].push(`${cat.slug} (${cat.name})`);
    return acc;
  }, {});

  const taxonomy = Object.entries(byGroup)
    .map(([group, cats]) => `${group}: ${cats.join(', ')}`)
    .join('\n');

  const prompt = `You are a recipe categorization expert. Given a recipe, suggest 2-6 categories from the available taxonomy that best describe it.

AVAILABLE CATEGORIES:
${taxonomy}

RECIPE:
Title: ${recipe.title}
${recipe.description ? `Description: ${recipe.description}` : ''}
${recipe.cuisine ? `Cuisine: ${recipe.cuisine}` : ''}
${recipe.course ? `Course: ${recipe.course}` : ''}
${recipe.tags?.length ? `Tags: ${recipe.tags.join(', ')}` : ''}
${recipe.ingredients?.length ? `Ingredients: ${recipe.ingredients.slice(0, 10).join(', ')}` : ''}

RULES:
- Suggest 2-6 category slugs (not names) that best match this recipe
- Include categories from different groups when appropriate (e.g., ingredient + cuisine + meal)
- Focus on the most specific matches (e.g., prefer 'chicken' over 'poultry')
- Only suggest categories from the available taxonomy above
- Return the slug (the part before the parentheses), not the display name

Return ONLY JSON:
{ "category_slugs": ["slug1", "slug2", ...], "reasoning": "brief explanation" }`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => 'Unable to read error');
    throw new Error(`Claude API error: ${response.status} - ${errorBody}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text ?? '';

  // Extract JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in Claude response');
  }

  const result = JSON.parse(jsonMatch[0]);

  // Validate that all suggested slugs exist in the available categories
  const validSlugs = new Set(categoryMap.map(c => c.slug));
  const filteredSlugs = (result.category_slugs || [])
    .filter(slug => validSlugs.has(slug))
    .slice(0, 6); // Max 6 categories per recipe

  return {
    category_slugs: filteredSlugs,
    reasoning: result.reasoning || 'No reasoning provided',
  };
}

// Parse CLI args
const args = process.argv.slice(2);
const limitIndex = args.indexOf('--limit');
const limit = limitIndex >= 0 ? parseInt(args[limitIndex + 1], 10) : null;
const dryRun = args.includes('--dry-run');

async function main() {
  console.log('=== Recipe Categories Backfill ===\n');
  if (dryRun) console.log('🔍 DRY RUN MODE - No database writes\n');
  if (limit) console.log(`📊 Processing limit: ${limit} recipes\n`);

  // 1. Fetch all categories
  console.log('📚 Fetching category taxonomy...');
  const { data: categories, error: catError } = await db
    .from('categories')
    .select('id, slug, name, group_id, category_groups!inner(slug)')
    .order('slug');

  if (catError || !categories) {
    console.error('❌ Failed to fetch categories:', catError);
    process.exit(1);
  }

  const categoryMap = categories.map(c => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    group_slug: c.category_groups.slug,
  }));

  console.log(`✅ Loaded ${categoryMap.length} categories across 8 groups\n`);

  // 2. Fetch all recipes (or limited set)
  console.log('🍽️  Fetching recipes...');
  let query = db
    .from('recipes')
    .select('id, title, description, cuisine, course, tags')
    .order('created_at');

  if (limit) query = query.limit(limit);

  const { data: recipes, error: recError } = await query;

  if (recError || !recipes) {
    console.error('❌ Failed to fetch recipes:', recError);
    process.exit(1);
  }

  console.log(`✅ Found ${recipes.length} recipes to categorize\n`);

  // 3. Process each recipe
  let processed = 0;
  let categorized = 0;
  let errors = 0;
  const batchDelay = 2500;

  for (const recipe of recipes) {
    processed++;
    const progress = `[${processed}/${recipes.length}]`;

    try {
      // Skip if recipe already has categories (for resume after rate limit)
      const { data: existing } = await db
        .from('recipe_categories')
        .select('category_id')
        .eq('recipe_id', recipe.id)
        .limit(1);

      if (existing && existing.length > 0) {
        console.log(`${progress} ⏭️  ${recipe.title}: Already has categories, skipping`);
        categorized++; // Count as categorized since it was done in a previous run
        continue;
      }

      // Fetch ingredients for this recipe
      const { data: ings } = await db
        .from('recipe_ingredients')
        .select('ingredient')
        .eq('recipe_id', recipe.id)
        .limit(10);

      const ingredients = (ings || []).map(i => i.ingredient).filter(Boolean);

      // Ask AI for category suggestions
      const suggestion = await suggestRecipeCategories(
        {
          title: recipe.title,
          description: recipe.description,
          cuisine: recipe.cuisine,
          course: recipe.course,
          tags: recipe.tags || [],
          ingredients,
        },
        categoryMap,
      );

      if (suggestion.category_slugs.length === 0) {
        console.log(`${progress} ⚠️  ${recipe.title}: No categories suggested`);
        continue;
      }

      // Map slugs to IDs
      const categoryIds = suggestion.category_slugs
        .map(slug => categoryMap.find(c => c.slug === slug)?.id)
        .filter(Boolean);

      if (categoryIds.length === 0) {
        console.log(`${progress} ⚠️  ${recipe.title}: No valid category IDs found`);
        continue;
      }

      console.log(
        `${progress} ✅ ${recipe.title}: ${suggestion.category_slugs.join(', ')} (${categoryIds.length} cats)`,
      );

      // Insert into recipe_categories (unless dry run)
      if (!dryRun) {
        const insertData = categoryIds.map(catId => ({
          recipe_id: recipe.id,
          category_id: catId,
        }));

        const { error: insertError } = await db
          .from('recipe_categories')
          .upsert(insertData, { onConflict: 'recipe_id,category_id' });

        if (insertError) {
          console.error(`${progress} ❌ Insert failed:`, insertError.message);
          errors++;
          continue;
        }
      }

      categorized++;

      // Small delay between recipes
      if (processed < recipes.length) {
        await new Promise(resolve => setTimeout(resolve, batchDelay));
      }
    } catch (err) {
      console.error(`${progress} ❌ ${recipe.title}:`, err.message);
      errors++;
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Processed: ${processed} recipes`);
  console.log(`Categorized: ${categorized} recipes`);
  console.log(`Errors: ${errors}`);
  if (dryRun) console.log('\n⚠️  DRY RUN - No changes written to database');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
