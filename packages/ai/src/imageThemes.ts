import { callClaude, HAIKU } from './client';

// ── Image Themes ──

export type ImageTheme =
  | 'bright_fresh'
  | 'farmhouse'
  | 'fine_dining'
  | 'editorial'
  | 'garden_fresh'
  | 'candlelit'
  | 'japanese_minimal'
  | 'mediterranean'
  | 'cozy_autumn'
  | 'modern_glam';

export interface ThemeDefinition {
  id: ImageTheme;
  name: string;
  emoji: string;
  description: string;
  prompt: string;
  previewImage: string;
}

export const IMAGE_THEMES: Record<ImageTheme, ThemeDefinition> = {
  bright_fresh: {
    id: 'bright_fresh',
    name: 'Bright & Fresh',
    emoji: '\u{1F31E}',
    description: 'Natural daylight, white marble, vibrant colors',
    prompt: 'natural window light, white marble surface, bright airy atmosphere, vibrant fresh colors, clean minimal styling, soft shadows',
    previewImage: '/images/themes/bright-fresh.jpg',
  },
  farmhouse: {
    id: 'farmhouse',
    name: 'Farmhouse',
    emoji: '\u{1FAB5}',
    description: 'Rustic wood table, warm golden hour light',
    prompt: 'rustic wooden table, linen napkins, warm golden hour light, farmhouse aesthetic, cast iron or ceramic, cozy homestyle',
    previewImage: '/images/themes/farmhouse.jpg',
  },
  fine_dining: {
    id: 'fine_dining',
    name: 'Fine Dining',
    emoji: '\u{1F37D}\uFE0F',
    description: 'Elegant plating, dramatic restaurant lighting',
    prompt: 'dark slate surface, elegant restaurant plating, dramatic side lighting, fine dining presentation, precise garnish, high contrast',
    previewImage: '/images/themes/fine-dining.jpg',
  },
  editorial: {
    id: 'editorial',
    name: 'Editorial',
    emoji: '\u{1F4F0}',
    description: 'Overhead flat lay, magazine aesthetic',
    prompt: 'overhead flat lay, styled food photography, magazine editorial aesthetic, neutral linen background, carefully arranged props',
    previewImage: '/images/themes/editorial.jpg',
  },
  garden_fresh: {
    id: 'garden_fresh',
    name: 'Garden Fresh',
    emoji: '\u{1F33F}',
    description: 'Outdoor natural setting, herbs and produce',
    prompt: 'outdoor garden setting, dappled natural light, fresh herbs scattered, terracotta surfaces, botanical atmosphere',
    previewImage: '/images/themes/garden-fresh.jpg',
  },
  candlelit: {
    id: 'candlelit',
    name: 'Candlelit',
    emoji: '\u{1F56F}\uFE0F',
    description: 'Moody evening atmosphere, warm candlelight',
    prompt: 'candlelight atmosphere, warm amber tones, moody evening lighting, dark rich background, intimate dinner setting',
    previewImage: '/images/themes/candlelit.jpg',
  },
  japanese_minimal: {
    id: 'japanese_minimal',
    name: 'Japanese Minimal',
    emoji: '\u{1F38B}',
    description: 'Clean white ceramic, zen simplicity',
    prompt: 'clean white ceramic, zen minimalist composition, Japanese aesthetic, negative space, precise plating, neutral background',
    previewImage: '/images/themes/japanese-minimal.jpg',
  },
  mediterranean: {
    id: 'mediterranean',
    name: 'Mediterranean',
    emoji: '\u{2600}\uFE0F',
    description: 'Bright sunshine, blue tiles, olive wood',
    prompt: 'bright Mediterranean sunshine, blue and white tiles, olive wood surface, vibrant produce colors, sun-drenched atmosphere',
    previewImage: '/images/themes/mediterranean.jpg',
  },
  cozy_autumn: {
    id: 'cozy_autumn',
    name: 'Cozy Autumn',
    emoji: '\u{1F342}',
    description: 'Warm amber tones, textured fabrics, hearty',
    prompt: 'warm amber autumn tones, textured wool or linen, cozy hygge atmosphere, rich earthy colors, comfort food styling',
    previewImage: '/images/themes/cozy-autumn.jpg',
  },
  modern_glam: {
    id: 'modern_glam',
    name: 'Modern Glam',
    emoji: '\u{2728}',
    description: 'Sleek black surfaces, high contrast, contemporary',
    prompt: 'sleek black marble surface, metallic accents, high contrast dramatic lighting, contemporary modern aesthetic, sophisticated',
    previewImage: '/images/themes/modern-glam.jpg',
  },
};

// ── Regeneration Pills ──

export interface RegenPill {
  id: string;
  label: string;
  modifier: string;
}

export const REGEN_PILLS: RegenPill[] = [
  { id: 'wrong_dish', label: 'Dish looks wrong', modifier: 'CRITICAL: the image must clearly show the dish named in the title. Completely different angle, plating, and background. Make the dish instantly recognizable.' },
  { id: 'update_scene', label: 'Change the scene', modifier: 'completely different background environment and surface material, different color palette' },
  { id: 'brighter', label: 'Make it brighter', modifier: 'very bright high-key lighting, white marble surface, airy overexposed atmosphere' },
  { id: 'moodier', label: 'Make it moodier', modifier: 'dark low-key dramatic lighting, deep shadows, candlelit atmosphere, rich dark tones' },
  { id: 'closer', label: 'Zoom in closer', modifier: 'extreme macro close-up shot, lens inches from food, bokeh background' },
  { id: 'overhead', label: 'Overhead view', modifier: 'perfect overhead aerial flat lay, camera pointing straight down at the dish' },
];

// ── Creativity Levels ──

export type CreativityLevel = 1 | 2 | 3 | 4 | 5;

export const CREATIVITY_LEVELS: Record<CreativityLevel, {
  label: string;
  description: string;
  useSourceDescription: boolean;
  promptModifier: string;
}> = {
  1: { label: 'Very Faithful', description: 'Very similar to source image', useSourceDescription: true, promptModifier: 'match the original presentation style closely' },
  2: { label: 'Faithful', description: 'Similar dish, similar presentation', useSourceDescription: true, promptModifier: 'similar plating style but with fresh styling' },
  3: { label: 'Balanced', description: 'Same dish, different presentation (recommended)', useSourceDescription: false, promptModifier: 'creative food styling, different from typical presentations' },
  4: { label: 'Creative', description: 'Inspired by the dish, unique styling', useSourceDescription: false, promptModifier: 'highly creative and artistic food photography, unique angle and styling' },
  5: { label: 'Very Creative', description: 'Completely original interpretation', useSourceDescription: false, promptModifier: 'completely original artistic interpretation, avant-garde food photography' },
};

// ── Prompt Builder ──

export function buildImagePrompt(
  recipe: { title: string; cuisine?: string | null; ingredients?: { ingredient?: string; name?: string }[]; source_image_description?: string | null },
  theme: ImageTheme = 'bright_fresh',
  modifier?: string,
  creativityLevel: CreativityLevel = 3,
): string {
  // Clean dish name — always anchors the prompt
  const dishName = recipe.title
    .replace(/recipe/gi, '')
    .replace(/how to make/gi, '')
    .replace(/\|.*$/, '')
    .trim();

  const keyIng = (recipe.ingredients ?? [])
    .slice(0, 3)
    .map((i) => i.ingredient || i.name || '')
    .filter(Boolean)
    .join(', ');

  // Levels 1-2 want source anchoring; if the field is NULL we can't deliver that,
  // so fall back to level 3 behavior rather than silently producing a level-3
  // prompt and labeling it "faithful".
  let effectiveLevel = creativityLevel;
  if (CREATIVITY_LEVELS[creativityLevel].useSourceDescription && !recipe.source_image_description) {
    console.warn(
      `[buildImagePrompt] creativityLevel=${creativityLevel} requested but ` +
        `source_image_description is NULL for "${dishName}" — falling back to level 3.`,
    );
    effectiveLevel = 3;
  }
  const creativity = CREATIVITY_LEVELS[effectiveLevel];

  const themePrompt = IMAGE_THEMES[theme]?.prompt ?? IMAGE_THEMES.bright_fresh.prompt;
  const modifierPrompt = modifier ? `, ${modifier}` : '';

  // Levels 1-2: faithful. Lead with strong source-anchoring directive so the
  // model treats the source description as primary reference, not a side note.
  if (creativity.useSourceDescription && recipe.source_image_description) {
    const leadIn = effectiveLevel === 1
      ? 'match this source very closely'
      : 'closely resemble this source';
    return [
      `Professional food photograph of ${dishName}`,
      `— ${leadIn}: ${recipe.source_image_description}`,
      keyIng ? `Key ingredients visible: ${keyIng}` : '',
      recipe.cuisine ? `${recipe.cuisine} cuisine` : '',
      creativity.promptModifier,
      themePrompt,
      modifierPrompt,
      'high resolution, no text, no watermarks, no people, photorealistic',
    ].filter(Boolean).join(', ');
  }

  // Levels 3-5 (or 1-2 with no source description): title + ingredients only.
  return [
    `Professional food photography of ${dishName}`,
    keyIng ? `featuring ${keyIng}` : '',
    recipe.cuisine ? `${recipe.cuisine} cuisine` : '',
    `served in a dish appropriate for ${dishName}`,
    creativity.promptModifier,
    themePrompt,
    modifierPrompt,
    'high resolution, no text, no watermarks, no people, photorealistic',
  ].filter(Boolean).join(', ');
}

// ── Model Selection ──

export function getImageModel(planTier: string, override?: string | null, creativityLevel?: CreativityLevel): string {
  if (override === 'dev') return 'black-forest-labs/flux-dev';
  if (override === 'schnell') return 'black-forest-labs/flux-schnell';
  // Levels 1-2 (faithful) need Dev for better prompt adherence
  if (creativityLevel && creativityLevel <= 2) return 'black-forest-labs/flux-dev';
  if (planTier === 'pro') return 'black-forest-labs/flux-dev';
  return 'black-forest-labs/flux-schnell';
}

// ── Source Image Description (Haiku Vision ~$0.005/call) ──

export async function describeSourceImage(
  imageUrl: string,
  recipeName: string,
): Promise<string | null> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const mimeType = (response.headers.get('content-type') || 'image/jpeg') as string;

    const result = await callClaude({
      model: HAIKU,
      prompt: `This is a photo of "${recipeName}". Describe the visual presentation in 2-3 sentences focusing on: the dish's appearance, plating style, colors, textures, serving vessel, and background/surface. Be specific and visual. Do not mention the recipe name. Start with the dish itself.`,
      imageBase64: base64,
      imageMimeType: mimeType,
      maxTokens: 150,
    });

    return result?.trim() || null;
  } catch {
    return null;
  }
}
