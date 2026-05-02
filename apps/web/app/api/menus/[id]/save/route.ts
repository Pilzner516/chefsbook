import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, cloneRecipe, createMenu, addMenuItem, getUserSavedMenuFromSource, getPublicMenu } from '@chefsbook/db';
import type { MenuCourse } from '@chefsbook/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sourceMenuId } = await params;

  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const token = authHeader.slice(7);
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const sourceMenu = await getPublicMenu(sourceMenuId);
    if (!sourceMenu) {
      return NextResponse.json({ error: 'menu_not_found' }, { status: 404 });
    }

    if (!sourceMenu.is_public) {
      return NextResponse.json({ error: 'menu_not_public' }, { status: 403 });
    }

    if (sourceMenu.user_id === user.id) {
      return NextResponse.json({ error: 'cannot_save_own_menu' }, { status: 400 });
    }

    const existingSaved = await getUserSavedMenuFromSource(user.id, sourceMenuId);
    if (existingSaved) {
      return NextResponse.json({
        already_saved: true,
        menu_id: existingSaved.id
      }, { status: 200 });
    }

    const newMenu = await createMenu({
      user_id: user.id,
      title: sourceMenu.title,
      description: sourceMenu.description,
      occasion: sourceMenu.occasion,
      public_notes: sourceMenu.public_notes,
      private_notes: null,
      is_public: false,
      cover_image_url: sourceMenu.cover_image_url,
      source_menu_id: sourceMenuId,
    });

    const clonedRecipeMap: Record<string, string> = {};
    let recipeCount = 0;

    for (const item of sourceMenu.menu_items) {
      if (!clonedRecipeMap[item.recipe_id]) {
        try {
          const newRecipeId = await cloneRecipe(item.recipe_id, user.id);
          clonedRecipeMap[item.recipe_id] = newRecipeId;
          recipeCount++;
        } catch (err) {
          console.error(`Failed to clone recipe ${item.recipe_id}:`, err);
          continue;
        }
      }
    }

    for (const item of sourceMenu.menu_items) {
      const clonedRecipeId = clonedRecipeMap[item.recipe_id];
      if (clonedRecipeId) {
        await addMenuItem(
          newMenu.id,
          clonedRecipeId,
          item.course as MenuCourse,
          item.sort_order,
          item.servings_override,
          item.notes
        );
      }
    }

    return NextResponse.json({
      menu_id: newMenu.id,
      recipe_count: recipeCount,
    });
  } catch (err) {
    console.error('Failed to save menu:', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
