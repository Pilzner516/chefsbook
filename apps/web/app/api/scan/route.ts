import { NextRequest, NextResponse } from 'next/server';
import { scanRecipe, scanRecipeMultiPage, getApiKey } from '@chefsbook/ai';

// POST /api/scan - Scan recipe from image(s)
export async function POST(request: NextRequest) {
  // Debug: log env var availability
  const apiKey = getApiKey();
  console.log('[/api/scan] API key available:', !!apiKey, 'length:', apiKey?.length || 0);
  console.log('[/api/scan] process.env.ANTHROPIC_API_KEY:', !!process.env.ANTHROPIC_API_KEY);

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
