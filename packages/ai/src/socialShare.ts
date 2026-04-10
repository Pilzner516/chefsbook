import { callClaude, HAIKU } from './client';

export async function generateSocialPost(params: {
  title: string;
  description: string | null;
  cuisine: string | null;
  ingredients: string[];
  platform: 'instagram' | 'pinterest' | 'facebook';
}): Promise<string> {
  const { title, description, cuisine, ingredients, platform } = params;

  const platformGuide = {
    instagram: 'Engaging, conversational, 150-220 chars, end with "Recipe saved on ChefsBook!"',
    pinterest: 'Descriptive, SEO-friendly, 200-500 chars, focus on what makes the recipe special, include key ingredients',
    facebook: 'Warm and personal, 100-300 chars, conversational tone, invite comments',
  }[platform];

  const prompt = `Generate a social media post for this recipe:
Title: ${title}
Description: ${description ?? ''}
Cuisine: ${cuisine ?? ''}
Key ingredients: ${ingredients.slice(0, 5).join(', ')}
Platform: ${platform}

Style: ${platformGuide}

Return ONLY the post text. No hashtags, no quotes, no explanation.`;

  return await callClaude({ prompt, maxTokens: 500, model: HAIKU });
}

export async function generateHashtags(params: {
  title: string;
  cuisine: string | null;
  course: string | null;
  tags: string[];
  ingredients: string[];
}): Promise<string[]> {
  const { title, cuisine, course, tags, ingredients } = params;

  const prompt = `Generate 15-20 relevant hashtags for this recipe:
Title: ${title}, Cuisine: ${cuisine ?? ''}, Course: ${course ?? ''}
Tags: ${tags.join(', ')}, Key ingredients: ${ingredients.slice(0, 5).join(', ')}

Include a mix of broad cooking tags (#recipe #cooking #homemade #foodie), cuisine-specific, ingredient-specific, meal type, and popular food tags (#foodphotography #instafood #easyrecipe).

Return ONLY space-separated hashtags starting with #. Nothing else.`;

  const text = await callClaude({ prompt, maxTokens: 300, model: HAIKU });
  return text.trim().split(/\s+/).filter((t) => t.startsWith('#'));
}
