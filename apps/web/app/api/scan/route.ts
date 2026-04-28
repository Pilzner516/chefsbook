import { NextRequest, NextResponse } from 'next/server';
import { scanRecipe, scanRecipeMultiPage } from '@chefsbook/ai';

// POST /api/scan - Scan recipe from image(s)
export async function POST(request: NextRequest) {
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
