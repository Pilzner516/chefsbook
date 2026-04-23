#!/usr/bin/env node
/**
 * Backfill title-only translations for recipes that don't have them yet.
 * Translates recipe titles into fr, es, it, de using HAIKU (~$0.0002/recipe).
 */

import { translateRecipeTitle } from '@chefsbook/ai';
import { saveTitleOnlyTranslations, supabaseAdmin } from '@chefsbook/db';

const BATCH_SIZE = 10;
const DELAY_MS = 2000; // 2s between batches to avoid rate limits

async function main() {
  console.log('🔍 Finding recipes without translations...\n');

  // Get all recipes that don't have French translations (proxy for "not translated")
  const { data: recipesNeedingTranslation } = await supabaseAdmin
    .from('recipes')
    .select('id, title')
    .not('id', 'in',
      supabaseAdmin
        .from('recipe_translations')
        .select('recipe_id')
        .eq('language', 'fr')
    )
    .order('created_at', { ascending: false });

  if (!recipesNeedingTranslation || recipesNeedingTranslation.length === 0) {
    console.log('✅ All recipes already have translations!');
    return;
  }

  console.log(`📝 Found ${recipesNeedingTranslation.length} recipes needing translation\n`);

  let translated = 0;
  let failed = 0;

  for (let i = 0; i < recipesNeedingTranslation.length; i += BATCH_SIZE) {
    const batch = recipesNeedingTranslation.slice(i, i + BATCH_SIZE);

    console.log(`\n--- Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(recipesNeedingTranslation.length / BATCH_SIZE)} ---`);

    for (const recipe of batch) {
      try {
        console.log(`Translating: "${recipe.title}"`);

        // Call Claude to translate title into all 4 languages
        const titles = await translateRecipeTitle(recipe.title);

        console.log(`  ✓ fr: ${titles.fr}`);
        console.log(`  ✓ es: ${titles.es}`);
        console.log(`  ✓ it: ${titles.it}`);
        console.log(`  ✓ de: ${titles.de}`);

        // Save translations to database
        await saveTitleOnlyTranslations(recipe.id, titles);

        translated++;
      } catch (error) {
        console.error(`  ✗ Error translating "${recipe.title}":`, error.message);
        failed++;
      }
    }

    // Delay between batches
    if (i + BATCH_SIZE < recipesNeedingTranslation.length) {
      console.log(`\n⏳ Waiting ${DELAY_MS}ms before next batch...`);
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`✅ Translation complete!`);
  console.log(`   Translated: ${translated} recipes`);
  console.log(`   Failed: ${failed} recipes`);
  console.log(`   Total cost: ~$${(translated * 0.0002).toFixed(4)}`);
  console.log('='.repeat(60));
}

main().catch(console.error);
