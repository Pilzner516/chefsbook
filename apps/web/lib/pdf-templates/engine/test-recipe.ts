/**
 * Test Recipe — Sample data for template validation and admin preview.
 *
 * Requirements:
 * - Title: 12+ words
 * - Description: 2 sentences
 * - 8 ingredients with quantities, units, and some preparation notes
 * - 9 steps with at least 3 long steps (30+ words)
 * - At least 2 additional images
 * - A timer value on at least one step
 * - A foreword
 * - Nutrition data
 */

import type { CookbookRecipe, CookbookPdfOptions } from './types';

/**
 * Comprehensive test recipe for template validation
 */
export const TEST_RECIPE: CookbookRecipe = {
  id: 'test-recipe-001',
  title: 'Slow-Roasted Mediterranean Lamb Shoulder with Herb Crust and Roasted Vegetables',
  description: 'A showstopping centerpiece for any gathering, this lamb shoulder is rubbed with fragrant herbs and roasted until fork-tender. The meat becomes incredibly succulent while developing a beautiful caramelized crust.',
  cuisine: 'Mediterranean',
  course: 'Main Course',
  total_minutes: 240,
  servings: 6,
  ingredients: [
    { quantity: 1, unit: 'whole', ingredient: 'lamb shoulder', preparation: 'bone-in, about 5 pounds', optional: false, group_label: null },
    { quantity: 4, unit: 'cloves', ingredient: 'garlic', preparation: 'minced', optional: false, group_label: null },
    { quantity: 2, unit: 'tbsp', ingredient: 'fresh rosemary', preparation: 'finely chopped', optional: false, group_label: null },
    { quantity: 2, unit: 'tbsp', ingredient: 'fresh thyme leaves', preparation: null, optional: false, group_label: null },
    { quantity: 0.25, unit: 'cup', ingredient: 'olive oil', preparation: 'extra virgin', optional: false, group_label: null },
    { quantity: 1, unit: 'tbsp', ingredient: 'kosher salt', preparation: null, optional: false, group_label: 'Seasoning' },
    { quantity: 1, unit: 'tsp', ingredient: 'black pepper', preparation: 'freshly ground', optional: false, group_label: 'Seasoning' },
    { quantity: 2, unit: 'lbs', ingredient: 'baby potatoes', preparation: 'halved', optional: false, group_label: 'Vegetables' },
  ],
  steps: [
    {
      step_number: 1,
      instruction: 'Remove the lamb shoulder from the refrigerator 2 hours before cooking to bring it to room temperature. This ensures even cooking throughout the meat and helps achieve a better crust.',
      timer_minutes: null,
      group_label: null,
    },
    {
      step_number: 2,
      instruction: 'Preheat your oven to 325°F (165°C). Position a rack in the lower third of the oven.',
      timer_minutes: null,
      group_label: null,
    },
    {
      step_number: 3,
      instruction: 'In a small bowl, combine the minced garlic, chopped rosemary, thyme leaves, olive oil, salt, and pepper to create a fragrant herb paste. The paste should be thick enough to adhere to the meat but spreadable.',
      timer_minutes: null,
      group_label: null,
    },
    {
      step_number: 4,
      instruction: 'Using a sharp knife, score the fat cap of the lamb shoulder in a crosshatch pattern, cutting about 1/4 inch deep. This allows the herb paste to penetrate the meat and helps render the fat during cooking.',
      timer_minutes: null,
      group_label: null,
    },
    {
      step_number: 5,
      instruction: 'Rub the herb paste generously all over the lamb shoulder, making sure to work it into the scored fat cap and all surfaces of the meat. Place the lamb in a large roasting pan.',
      timer_minutes: null,
      group_label: null,
    },
    {
      step_number: 6,
      instruction: 'Cover the roasting pan tightly with aluminum foil and roast for 3 hours. The low and slow cooking method breaks down the collagen in the shoulder, resulting in incredibly tender meat that falls off the bone.',
      timer_minutes: 180,
      group_label: 'Roasting',
    },
    {
      step_number: 7,
      instruction: 'Remove the foil and add the halved baby potatoes around the lamb. Continue roasting uncovered for another 45 minutes to 1 hour, until the lamb is deeply browned and the internal temperature reaches 195°F.',
      timer_minutes: 45,
      group_label: 'Roasting',
    },
    {
      step_number: 8,
      instruction: 'Transfer the lamb to a cutting board and tent loosely with foil. Let it rest for 20 minutes before carving. This allows the juices to redistribute throughout the meat.',
      timer_minutes: 20,
      group_label: 'Finishing',
    },
    {
      step_number: 9,
      instruction: 'Carve the lamb and serve with the roasted potatoes and accumulated pan juices. Garnish with fresh rosemary sprigs.',
      timer_minutes: null,
      group_label: 'Finishing',
    },
  ],
  notes: 'Leftover lamb makes excellent sandwiches or can be shredded for tacos. The pan juices can be strained and used as a simple sauce. For an extra crispy crust, you can briefly broil the lamb after the initial roasting period.',
  image_urls: [
    'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBkOWI1Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjI0IiBmaWxsPSIjOGI0NTEzIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+TGFtYiBTaG91bGRlcjwvdGV4dD48L3N2Zz4=',
    'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZDBiOGE4Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjI0IiBmaWxsPSIjNzA1MDMwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+QWRkaXRpb25hbCBJbWFnZSAxPC90ZXh0Pjwvc3ZnPg==',
    'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjYzhiOGE4Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjI0IiBmaWxsPSIjNjA0MDMwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+QWRkaXRpb25hbCBJbWFnZSAyPC90ZXh0Pjwvc3ZnPg==',
  ],
  custom_pages: undefined,
  fillType: 'chefs_notes',
  fillContent: undefined,
};

/**
 * Comprehensive test cookbook options for full PDF generation tests
 */
export const TEST_COOKBOOK_OPTIONS: CookbookPdfOptions = {
  cookbook: {
    title: 'A Celebration of Mediterranean Cooking',
    subtitle: 'Recipes from sun-drenched shores',
    author_name: 'Test Chef',
    cover_style: 'classic',
    cover_image_url: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBkOWI1Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjI0IiBmaWxsPSIjOGI0NTEzIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+Q292ZXIgSW1hZ2U8L3RleHQ+PC9zdmc+',
    foreword: 'This collection represents years of travel through the Mediterranean, gathering recipes from home cooks and professional chefs alike. Each dish tells a story of sun-drenched afternoons, bustling markets, and the simple joy of sharing good food with loved ones. I hope these recipes bring a taste of the Mediterranean into your kitchen.',
    pageSize: 'letter',
  },
  recipes: [TEST_RECIPE],
  chefsHatBase64: undefined,
  language: 'en',
};

/**
 * Get a minimal test recipe for quick validation
 */
export function getMinimalTestRecipe(): CookbookRecipe {
  return {
    id: 'test-minimal',
    title: 'Simple Test Recipe',
    description: 'A minimal recipe for quick tests.',
    ingredients: [
      { quantity: 1, unit: 'cup', ingredient: 'ingredient one', preparation: null, optional: false, group_label: null },
      { quantity: 2, unit: 'tbsp', ingredient: 'ingredient two', preparation: null, optional: false, group_label: null },
    ],
    steps: [
      { step_number: 1, instruction: 'Do step one.', timer_minutes: null, group_label: null },
      { step_number: 2, instruction: 'Do step two.', timer_minutes: null, group_label: null },
    ],
    image_urls: [],
  };
}
