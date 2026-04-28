import { NextRequest, NextResponse } from 'next/server';
import { scanRecipe, scanRecipeMultiPage } from '@chefsbook/ai';

// POST /api/scan - Scan recipe from image(s)
export async function POST(request: NextRequest) {
  // Debug: log all ANTHROPIC env vars
  console.log('[/api/scan] ANTHROPIC_API_KEY exists:', !!process.env.ANTHROPIC_API_KEY);
  console.log('[/api/scan] EXPO_PUBLIC_ANTHROPIC_API_KEY exists:', !!process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY);
  console.log('[/api/scan] Key length:', (process.env.ANTHROPIC_API_KEY || process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY || '').length);

  // If env vars aren't available, return early with helpful error
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('[/api/scan] No API key found in environment');
    return NextResponse.json(
      { error: 'Server configuration error: API key not available' },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { imageBase64, mimeType, images } = body;

    // Multi-image scan
    if (images && Array.isArray(images) && images.length > 0) {
      const result = await scanRecipeMultiPage(images);
      return NextResponse.json(result);
    }

    // Single image scan
    if (!imageBase64) {
      return NextResponse.json({ error: 'imageBase64 is required' }, { status: 400 });
    }

    const result = await scanRecipe(imageBase64, mimeType || 'image/jpeg');
    return NextResponse.json(result);
  } catch (error) {
    console.error('Scan error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Scan failed' },
      { status: 500 }
    );
  }
}
