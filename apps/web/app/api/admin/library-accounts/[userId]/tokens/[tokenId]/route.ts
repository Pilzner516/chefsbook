import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@chefsbook/db';

// DELETE /api/admin/library-accounts/[userId]/tokens/[tokenId]
// Revoke a library account import token
export async function DELETE(
  req: NextRequest,
  { params }: { params: { userId: string; tokenId: string } }
) {
  try {
    // Verify super admin
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is super_admin
    const { data: adminUser } = await supabaseAdmin
      .from('admin_users')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!adminUser || adminUser.role !== 'super_admin') {
      return NextResponse.json({ error: 'Super admin access required' }, { status: 403 });
    }

    const { userId, tokenId } = params;

    // Verify token belongs to this library account
    const { data: tokenData } = await supabaseAdmin
      .from('library_account_tokens')
      .select('id')
      .eq('id', tokenId)
      .eq('user_id', userId)
      .single();

    if (!tokenData) {
      return NextResponse.json({ error: 'Token not found' }, { status: 404 });
    }

    // Revoke the token (set is_active to false)
    const { error: updateError } = await supabaseAdmin
      .from('library_account_tokens')
      .update({ is_active: false })
      .eq('id', tokenId);

    if (updateError) {
      console.error('Failed to revoke token:', updateError);
      return NextResponse.json({ error: 'Failed to revoke token' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Token revocation error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
