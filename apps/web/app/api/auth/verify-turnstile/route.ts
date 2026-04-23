import { NextRequest, NextResponse } from 'next/server';
import { verifyTurnstile } from '@/lib/turnstile';
import { supabaseAdmin } from '@chefsbook/db';

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();

    if (!token) {
      return NextResponse.json({ success: false, error: 'No token provided' }, { status: 400 });
    }

    // Check if bot protection is enabled before verifying
    const { data: setting } = await supabaseAdmin
      .from('system_settings')
      .select('value')
      .eq('key', 'bot_protection_enabled')
      .single();

    if (setting?.value !== 'true') {
      // Bot protection is disabled — skip verification
      return NextResponse.json({ success: true });
    }

    // Otherwise proceed with Cloudflare verification
    const verified = await verifyTurnstile(token);

    if (!verified) {
      return NextResponse.json({ success: false, error: 'Verification failed' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error in POST /api/auth/verify-turnstile:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
