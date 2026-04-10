const SONNET = 'claude-sonnet-4-20250514';
const HAIKU = 'claude-haiku-4-5-20251001';
const API_URL = 'https://api.anthropic.com/v1/messages';

export { SONNET, HAIKU };

export function getApiKey(): string {
  return (
    process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ??
    process.env.ANTHROPIC_API_KEY ?? ''
  );
}

export async function callClaude(params: {
  prompt: string;
  imageBase64?: string;
  imageMimeType?: string;
  /** Multiple images for multi-page scanning */
  images?: { base64: string; mimeType?: string }[];
  maxTokens?: number;
  /** Model override — defaults to Sonnet. Use HAIKU for classification tasks. */
  model?: string;
}): Promise<string> {
  const { prompt, imageBase64, imageMimeType = 'image/jpeg', images, maxTokens = 2000, model = SONNET } = params;

  const content: any[] = [];
  // Multi-image support (takes precedence over single image)
  if (images && images.length > 0) {
    for (const img of images) {
      content.push({ type: 'image', source: { type: 'base64', media_type: img.mimeType || 'image/jpeg', data: img.base64 } });
    }
  } else if (imageBase64) {
    content.push({ type: 'image', source: { type: 'base64', media_type: imageMimeType, data: imageBase64 } });
  }
  content.push({ type: 'text', text: prompt });

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': getApiKey(), 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'user', content }] }),
  });

  if (!response.ok) throw new Error(`Claude API error: ${response.status}`);
  const data = await response.json();
  return data.content?.[0]?.text ?? '';
}

export function extractJSON<T>(text: string): T {
  const match = text.match(/```json\s*([\s\S]*?)```/) ?? text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (!match) throw new Error('No JSON found in Claude response');
  return JSON.parse(match[1] ?? match[0]);
}
