import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PLAN_LIMITS, checkRecipeLimit, logAiCall, addRecipePhoto } from '@chefsbook/db';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

interface SavePost {
  uri: string;
  imageBase64: string;
  extracted: {
    title: string | null;
    cuisine: string | null;
    tags: string[];
    notes: string | null;
  };
  timestamp: number;
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('plan_tier')
      .eq('id', user.id)
      .single();

    const plan = (profile?.plan_tier ?? 'free') as keyof typeof PLAN_LIMITS;
    if (plan !== 'pro') {
      return NextResponse.json(
        { error: 'plan_required', plan: 'pro' },
        { status: 403 }
      );
    }

    const { posts } = (await request.json()) as { posts: SavePost[] };
    if (!Array.isArray(posts) || posts.length === 0) {
      return NextResponse.json({ error: 'No posts provided' }, { status: 400 });
    }

    let saved = 0;
    let skipped = 0;
    let limitReached = false;
    const recipeIds: string[] = [];

    for (const post of posts) {
      const { data: existing } = await supabaseAdmin
        .from('recipes')
        .select('id')
        .eq('user_id', user.id)
        .eq('source_instagram_uri', post.uri)
        .maybeSingle();

      if (existing) {
        skipped++;
        continue;
      }

      const limitCheck = await checkRecipeLimit(user.id);
      if (!limitCheck.allowed) {
        limitReached = true;
        break;
      }

      const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      const imageBuffer = Buffer.from(post.imageBase64, 'base64');

      const { error: uploadError } = await supabaseAdmin.storage
        .from('recipe-user-photos')
        .upload(fileName, imageBuffer, {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (uploadError) {
        console.error('[instagram-export/save] Upload error:', uploadError);
        continue;
      }

      const internalUrl = `${supabaseUrl}/storage/v1/object/public/recipe-user-photos/${fileName}`;

      const tags = ['instagram', '_incomplete', ...(post.extracted.tags || [])];

      const { data: recipe, error: insertError } = await supabaseAdmin
        .from('recipes')
        .insert({
          user_id: user.id,
          title: post.extracted.title || 'Untitled Instagram Recipe',
          description: null,
          source_type: 'instagram_export',
          source_url: 'https://www.instagram.com',
          source_instagram_uri: post.uri,
          notes: post.extracted.notes,
          cuisine: post.extracted.cuisine,
          tags,
          is_complete: false,
          visibility: 'private',
        })
        .select('id')
        .single();

      if (insertError || !recipe) {
        console.error('[instagram-export/save] Insert error:', insertError);
        continue;
      }

      try {
        await addRecipePhoto(recipe.id, user.id, fileName, internalUrl, undefined);

        await supabaseAdmin
          .from('recipe_user_photos')
          .update({ is_primary: true })
          .eq('recipe_id', recipe.id)
          .eq('user_id', user.id);
      } catch (photoError) {
        console.error('[instagram-export/save] Photo error:', photoError);
      }

      try {
        await fetch('http://localhost:3000/api/recipes/finalize', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ recipeId: recipe.id }),
        });
      } catch (finalizeError) {
        console.error('[instagram-export/save] Finalize error:', finalizeError);
      }

      await logAiCall({
        userId: user.id,
        action: 'instagram_export_save',
        model: 'none',
        tokensIn: 0,
        tokensOut: 0,
        recipeId: recipe.id,
        success: true,
        metadata: { uri: post.uri },
      });

      saved++;
      recipeIds.push(recipe.id);
    }

    return NextResponse.json({ saved, skipped, limitReached, recipeIds });
  } catch (error) {
    console.error('[instagram-export/save] Error:', error);
    return NextResponse.json(
      { error: 'Save failed' },
      { status: 500 }
    );
  }
}
