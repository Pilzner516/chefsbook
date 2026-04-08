import { callClaude, extractJSON } from './client';
import type { ScannedRecipe } from '@chefsbook/db';

// ── Types ──

export interface InstagramPostData {
  imageUrl: string | null;
  caption: string | null;
  postUrl: string;
}

export type InstagramRecipeResult =
  | { has_recipe: true; recipe: ScannedRecipe }
  | { has_recipe: false; dish_name: string };

// ── Fetch Instagram post ──

export async function fetchInstagramPost(postUrl: string): Promise<InstagramPostData> {
  // Fetch the HTML page and extract og:image + og:description
  const res = await fetch(postUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  if (!res.ok) {
    throw new Error(`Could not access Instagram post (${res.status}). It may be private or the link may have expired.`);
  }

  const html = await res.text();

  // Extract og:image
  const ogImageMatch =
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  const imageUrl = ogImageMatch?.[1] && /^https?:\/\//.test(ogImageMatch[1])
    ? ogImageMatch[1]
    : null;

  // Extract og:description (caption)
  const ogDescMatch =
    html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i);
  const caption = ogDescMatch?.[1]
    ? ogDescMatch[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    : null;

  return { imageUrl, caption, postUrl };
}

// ── Extract recipe from Instagram content ──

const INSTAGRAM_PROMPT = `You are analysing an Instagram post to extract a recipe.

Post URL: {{postUrl}}
Caption text: {{caption}}

{{imageNote}}

Determine: does this Instagram post contain a recipe?

If YES: extract the complete recipe. Return JSON only:
{
  "has_recipe": true,
  "title": "string",
  "description": "1-2 sentence description of the dish",
  "servings": number | null,
  "prep_minutes": number | null,
  "cook_minutes": number | null,
  "cuisine": "string | null",
  "course": "breakfast|brunch|lunch|dinner|starter|main|side|dessert|snack|drink|bread|other|null",
  "ingredients": [
    { "quantity": number|null, "unit": "string|null", "ingredient": "string", "preparation": "string|null", "optional": false, "group_label": "string|null" }
  ],
  "steps": [
    { "step_number": 1, "instruction": "string", "timer_minutes": number|null, "group_label": "string|null" }
  ],
  "notes": "string | null",
  "source_type": "url"
}

If NO (it's just a photo of food with no recipe): return:
{
  "has_recipe": false,
  "dish_name": "your best guess at the dish name from the image and caption"
}

Rules:
- A recipe must have identifiable ingredients AND steps/instructions. Just a list of ingredients with no method is not a recipe.
- Captions often contain recipes in a casual format — extract and structure them.
- If the caption has partial info (e.g. "ingredients: flour, sugar, eggs" but no steps), return has_recipe: false.
- description must never be null — generate a 1-2 sentence description if not explicit.

Return JSON only, no other text.`;

export async function extractRecipeFromInstagram(
  params: InstagramPostData,
): Promise<InstagramRecipeResult> {
  const { imageUrl, caption, postUrl } = params;

  const prompt = INSTAGRAM_PROMPT
    .replace('{{postUrl}}', postUrl)
    .replace('{{caption}}', caption ?? 'No caption available')
    .replace(
      '{{imageNote}}',
      imageUrl ? 'An image from the post is also attached.' : 'No image available.',
    );

  // If we have an image URL, download it and send as vision input
  let imageBase64: string | undefined;
  if (imageUrl) {
    try {
      const imgRes = await fetch(imageUrl);
      if (imgRes.ok) {
        const buffer = await imgRes.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        imageBase64 = btoa(binary);
      }
    } catch {
      // Image download failed — proceed with text-only analysis
    }
  }

  const text = await callClaude({
    prompt,
    imageBase64,
    imageMimeType: 'image/jpeg',
    maxTokens: 4000,
  });

  const result = extractJSON<any>(text);

  if (result.has_recipe === false) {
    return { has_recipe: false, dish_name: result.dish_name ?? 'Unknown dish' };
  }

  // Map to ScannedRecipe
  const recipe: ScannedRecipe = {
    title: result.title,
    description: result.description ?? null,
    servings: result.servings ?? null,
    prep_minutes: result.prep_minutes ?? null,
    cook_minutes: result.cook_minutes ?? null,
    cuisine: result.cuisine ?? null,
    course: result.course ?? null,
    ingredients: result.ingredients ?? [],
    steps: result.steps ?? [],
    notes: result.notes ?? null,
    source_type: 'url',
  };

  return { has_recipe: true, recipe };
}
