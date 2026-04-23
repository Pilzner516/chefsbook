import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@chefsbook/db';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get recipe to check ownership
    const { data: recipe } = await supabaseAdmin
      .from('recipes')
      .select('user_id')
      .eq('id', id)
      .single();

    if (!recipe) {
      return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
    }

    // Only owner can see saver stats
    if (recipe.user_id !== user.id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Count how many OTHER users have saved this recipe
    const { count: saverCount } = await supabaseAdmin
      .from('recipe_saves')
      .select('*', { count: 'exact', head: true })
      .eq('recipe_id', id)
      .neq('user_id', recipe.user_id);

    return NextResponse.json({
      saverCount: saverCount || 0,
    });
  } catch (error) {
    console.error('Error getting recipe stats:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const adminDelete = searchParams.get('adminDelete') === 'true';

    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get recipe
    const { data: recipe } = await supabaseAdmin
      .from('recipes')
      .select('user_id, title')
      .eq('id', id)
      .single();

    if (!recipe) {
      return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
    }

    // Count savers (excluding owner)
    const { count: saverCount } = await supabaseAdmin
      .from('recipe_saves')
      .select('*', { count: 'exact', head: true })
      .eq('recipe_id', id)
      .neq('user_id', recipe.user_id);

    if (adminDelete) {
      // Admin delete: verify admin status server-side
      const { data: adminRow } = await supabaseAdmin
        .from('admin_users')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!adminRow) {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
      }

      // Admin can delete regardless of savers - cascade handles recipe_saves
      const { error: deleteError } = await supabaseAdmin
        .from('recipes')
        .delete()
        .eq('id', id);

      if (deleteError) {
        console.error('Admin delete error:', deleteError);
        return NextResponse.json({ error: deleteError.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: 'Recipe permanently deleted',
        saverCount: saverCount || 0,
      });
    }

    // Regular delete: must be owner
    if (recipe.user_id !== user.id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Check if others have saved this recipe
    if (saverCount && saverCount > 0) {
      return NextResponse.json(
        {
          error: 'RECIPE_HAS_SAVERS',
          saverCount,
          message: `${saverCount} member${saverCount === 1 ? ' has' : 's have'} saved this recipe`,
        },
        { status: 403 }
      );
    }

    // No savers - proceed with delete
    const { error: deleteError } = await supabaseAdmin
      .from('recipes')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Delete error:', deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting recipe:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
