import { callClaude, extractJSON } from './client';
import { logAiCall } from '@chefsbook/db';
import type { MenuCourse } from '@chefsbook/db';

export interface ExtractedDish {
  name: string;
  description: string | null;
  section: string | null;
  suggested_course: MenuCourse;
}

export interface ExtractMenuDishesResult {
  restaurant_name: string | null;
  dishes: ExtractedDish[];
}

const EXTRACT_MENU_PROMPT = `You are a culinary assistant. The user has scanned a restaurant menu or specials board.
Extract every dish you can find. For each dish return: the exact name as printed,
any description text from the menu (ingredients, preparation notes), the section heading
it appears under, and a suggested course category.

Map section headings to courses loosely:
- Starters, Appetizers, Antipasti, Entrées (French) → "starter"
- Soups, Zuppe, Potages → "soup"
- Salads, Insalate → "salad"
- Mains, Main Courses, Secondi, Plats → "main"
- Sides, Contorni, Accompaniments → "side"
- Cheese, Fromage, Formaggi → "cheese"
- Desserts, Dolci, Sweets → "dessert"
- Drinks, Beverages, Cocktails, Wine → "drink"
- Anything else → "other"

Respond ONLY with valid JSON. No preamble, no markdown, no explanation.

{
  "restaurant_name": "string or null",
  "dishes": [
    {
      "name": "string",
      "description": "string or null",
      "section": "string or null",
      "suggested_course": "starter|soup|salad|main|side|cheese|dessert|drink|other"
    }
  ]
}`;

export async function extractMenuDishes(
  pageImages: { base64: string; mimeType?: string }[],
): Promise<ExtractMenuDishesResult> {
  if (pageImages.length === 0) {
    throw new Error('No menu images to extract');
  }

  const startTime = Date.now();
  let text: string;

  if (pageImages.length === 1) {
    text = await callClaude({
      prompt: EXTRACT_MENU_PROMPT,
      imageBase64: pageImages[0].base64,
      imageMimeType: pageImages[0].mimeType ?? 'image/jpeg',
      maxTokens: 4000,
    });
  } else {
    text = await callClaude({
      prompt: EXTRACT_MENU_PROMPT,
      images: pageImages.map((p) => ({
        base64: p.base64,
        mimeType: p.mimeType ?? 'image/jpeg',
      })),
      maxTokens: 6000,
    });
  }

  const result = extractJSON<ExtractMenuDishesResult>(text);

  const duration = Date.now() - startTime;
  const inputTokens = pageImages.length * 1500 + 500;
  const outputTokens = Math.ceil(text.length / 4);

  try {
    await logAiCall({
      action: 'menu_scan_extract',
      model: 'sonnet',
      tokensIn: inputTokens,
      tokensOut: outputTokens,
      durationMs: duration,
    });
  } catch {
    // non-blocking
  }

  return result;
}
