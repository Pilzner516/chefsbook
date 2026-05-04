import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@chefsbook/db';
import crypto from 'crypto';

// POST /api/admin/library-accounts/[userId]/tokens
// Generate a new import token for a library account
export async function POST(
  req: NextRequest,
  { params }: { params: { userId: string } }
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

    const { userId } = params;
    const body = await req.json();
    const { description } = body;

    if (!description || typeof description !== 'string') {
      return NextResponse.json({ error: 'Description is required' }, { status: 400 });
    }

    // Verify that userId is a library account
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('account_type')
      .eq('id', userId)
      .single();

    if (!profile || profile.account_type !== 'library') {
      return NextResponse.json({ error: 'Not a library account' }, { status: 400 });
    }

    // Generate a cryptographically secure random token (64 characters)
    const plainToken = crypto.randomBytes(48).toString('base64');

    // Hash the token for storage (SHA-256)
    const tokenHash = crypto.createHash('sha256').update(plainToken).digest('hex');

    // Insert token record
    const { error: insertError } = await supabaseAdmin
      .from('library_account_tokens')
      .insert({
        user_id: userId,
        token_hash: tokenHash,
        description,
        created_by: user.id,
        is_active: true,
      });

    if (insertError) {
      console.error('Failed to create library token:', insertError);
      return NextResponse.json({ error: 'Failed to create token' }, { status: 500 });
    }

    // Return the plain token (only time it will be shown)
    return NextResponse.json({ token: plainToken });
  } catch (err) {
    console.error('Library token generation error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
