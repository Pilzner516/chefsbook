import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@chefsbook/db';
import { translateRecipe } from '@chefsbook/ai';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { recipe, targetLanguage } = body;

    if (!recipe || !targetLanguage || targetLanguage === 'en') {
      return NextResponse.json({ error: 'Missing recipe or targetLanguage' }, { status: 400 });
    }

    const result = await translateRecipe(recipe, targetLanguage);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[api/recipes/translate] Error:', err);
    return NextResponse.json({ error: err.message || 'Translation failed' }, { status: 500 });
  }
}
