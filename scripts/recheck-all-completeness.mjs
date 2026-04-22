#!/usr/bin/env node
/**
 * One-time sweep: Re-evaluate completeness for ALL recipes
 * Updates missing_fields and is_complete based on current data
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function checkRecipeCompleteness(recipe) {
  const missing = [];

  if (!recipe.title || recipe.title.trim() === '') missing.push('title');
  if (!recipe.description || recipe.description.trim() === '') missing.push('description');

  const ingredients = recipe.ingredients || [];

  // Check ingredient names (required)
  const ingredientsWithName = ingredients.filter((i) => {
    const name = i.ingredient ?? i.name;
    return name && name.trim() !== '';
  });

  if (ingredientsWithName.length < 2) missing.push('ingredients (minimum 2)');

  // Check for bulk missing quantities pattern (75%+ threshold)
  if (ingredients.length >= 2) {
    const threshold = Math.ceil(ingredients.length * 0.75);

    // Count ingredients with missing/zero quantity
    const missingQty = ingredients.filter((i) => {
      const qty = i.quantity ?? i.amount;
      return qty === null || qty === undefined || qty === 0;
    }).length;

    // Count ingredients with BOTH missing/zero quantity AND no unit
    const missingQtyAndUnit = ingredients.filter((i) => {
      const qty = i.quantity ?? i.amount;
      return (qty === null || qty === undefined || qty === 0) && !i.unit;
    }).length;

    if (missingQty >= threshold || missingQtyAndUnit >= threshold) {
      missing.push('ingredient quantities');
    }
  }

  const steps = recipe.steps || [];
  if (steps.length < 1) missing.push('steps');

  return {
    isComplete: missing.length === 0,
    missingFields: missing,
  };
}

async function main() {
  console.log('Fetching all recipes...');

  const { data: allRecipes, error: recipesError } = await supabase
    .from('recipes')
    .select('id, title, description, tags');

  if (recipesError) {
    console.error('Error fetching recipes:', recipesError);
    process.exit(1);
  }

  console.log(`Found ${allRecipes.length} recipes to check`);

  let updated = 0;
  let alreadyCorrect = 0;
  let errors = 0;

  for (const recipe of allRecipes) {
    try {
      // Fetch ingredients
      const { data: ingredients } = await supabase
        .from('recipe_ingredients')
        .select('quantity, unit, ingredient')
        .eq('recipe_id', recipe.id);

      // Fetch steps
      const { data: steps } = await supabase
        .from('recipe_steps')
        .select('instruction')
        .eq('recipe_id', recipe.id);

      const result = checkRecipeCompleteness({
        title: recipe.title,
        description: recipe.description,
        tags: recipe.tags,
        ingredients: ingredients || [],
        steps: steps || [],
      });

      // Check if update is needed
      const { data: current } = await supabase
        .from('recipes')
        .select('is_complete, missing_fields')
        .eq('id', recipe.id)
        .single();

      const needsUpdate =
        current?.is_complete !== result.isComplete ||
        JSON.stringify(current?.missing_fields || []) !== JSON.stringify(result.missingFields);

      if (needsUpdate) {
        await supabase
          .from('recipes')
          .update({
            is_complete: result.isComplete,
            missing_fields: result.missingFields,
            completeness_checked_at: new Date().toISOString(),
          })
          .eq('id', recipe.id);

        updated++;
        console.log(`✓ Updated ${recipe.id} (${recipe.title}): complete=${result.isComplete}, missing=[${result.missingFields.join(', ')}]`);
      } else {
        alreadyCorrect++;
      }
    } catch (err) {
      errors++;
      console.error(`✗ Error processing ${recipe.id}:`, err.message);
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Total recipes: ${allRecipes.length}`);
  console.log(`Updated: ${updated}`);
  console.log(`Already correct: ${alreadyCorrect}`);
  console.log(`Errors: ${errors}`);
}

main();
