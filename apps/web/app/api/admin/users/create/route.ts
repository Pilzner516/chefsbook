import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@chefsbook/db';

/** Verify the request is from an admin user. Returns userId or null. */
async function verifyAdmin(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return null;
  const { data } = await supabaseAdmin.from('admin_users').select('role').eq('user_id', user.id).single();
  if (!data) return null;
  return user.id;
}

export async function POST(req: NextRequest) {
  try {
    // Verify admin status
    const adminId = await verifyAdmin(req);
    if (!adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const { email, password, username, displayName, plan, role, sendWelcomeEmail } = await req.json();

    // Validate required fields
    if (!email || !password || !username || !plan || !role) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate password strength
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    // Validate plan
    if (!['free', 'chef', 'family', 'pro'].includes(plan)) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    // Validate role
    if (!['user', 'admin'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    console.log('[admin/users/create] Creating account for:', email, 'username:', username, 'plan:', plan, 'role:', role);

    // Check if username is already taken
    const { data: existingUsername } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
      .eq('username', username)
      .single();

    if (existingUsername) {
      return NextResponse.json({ error: 'This username is already taken' }, { status: 400 });
    }

    // Create auth user using service role client
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm, no email verification needed
      user_metadata: {
        username,
        display_name: displayName || username,
      },
    });

    if (authError) {
      console.error('[admin/users/create] FULL AUTH ERROR:', JSON.stringify(authError, null, 2));
      console.error('[admin/users/create] Auth error message:', authError.message);
      console.error('[admin/users/create] Auth error status:', authError.status);
      console.error('[admin/users/create] Auth error name:', authError.name);
      // Check for specific error messages
      if (authError.message?.includes('already registered')) {
        return NextResponse.json({ error: 'An account with this email already exists' }, { status: 400 });
      }
      return NextResponse.json({
        error: `Failed to create auth user: ${authError.message}`,
        details: authError
      }, { status: 500 });
    }

    if (!authData.user) {
      return NextResponse.json({ error: 'Failed to create user account' }, { status: 500 });
    }

    console.log('[admin/users/create] Auth user created:', authData.user.id);

    // Update user_profiles row (auto-created by trigger on auth.users insert)
    // The trigger creates a basic profile, we update it with admin-specified values
    const { error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .update({
        username,
        display_name: displayName || username,
        plan_tier: plan,
      })
      .eq('id', authData.user.id);

    if (profileError) {
      console.error('[admin/users/create] Failed to update user profile:', profileError);
      // Attempt to delete the auth user if profile update fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json({ error: 'Failed to update user profile' }, { status: 500 });
    }

    // If role is admin, insert into admin_users table
    if (role === 'admin') {
      const { error: adminError } = await supabaseAdmin.from('admin_users').insert({
        user_id: authData.user.id,
        role: 'admin',
      });

      if (adminError) {
        console.error('[admin/users/create] Failed to create admin user:', adminError);
        // Note: We don't rollback here, just log the error
        // The user account is still created, just without admin permissions
      } else {
        console.log('[admin/users/create] Admin permissions granted');
      }
    }

    // TODO: Send welcome email if sendWelcomeEmail is true
    // Check how other emails are sent in the codebase and implement here

    console.log('[admin/users/create] Account created successfully');
    return NextResponse.json({
      success: true,
      userId: authData.user.id,
      email,
      username,
    });
  } catch (err: any) {
    console.error('[admin/users/create] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
