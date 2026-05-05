import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@chefsbook/db';

const COOKED_IT_POINTS = 5;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: sessionId } = await params;

    // Mark session as complete
    const { error: updateError } = await supabaseAdmin
      .from('cooking_sessions')
      .update({
        status: 'complete',
        completed_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
      .eq('user_id', user.id);

    if (updateError) {
      console.error('[cook/complete] Session update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to complete session' },
        { status: 500 }
      );
    }

    // Award points (fire-and-forget, graceful if points system not live)
    let pointsAwarded = 0;
    let newBadges: string[] = [];

    try {
      // Check if user_points_balance table exists and award points
      const { data: pointsData, error: pointsError } = await supabaseAdmin
        .from('user_points_balance')
        .select('balance')
        .eq('user_id', user.id)
        .single();

      if (!pointsError && pointsData !== null) {
        // Table exists, award points
        const newBalance = (pointsData.balance || 0) + COOKED_IT_POINTS;

        await supabaseAdmin
          .from('user_points_balance')
          .update({ balance: newBalance })
          .eq('user_id', user.id);

        pointsAwarded = COOKED_IT_POINTS;

        // Check badge thresholds (if user_badges table exists)
        // This is a simplified check - actual badge logic may be more complex
        const { data: badges } = await supabaseAdmin
          .from('user_badges')
          .select('badge_id')
          .eq('user_id', user.id);

        // Example: "Cooked it!" badge at first completion
        if (badges && badges.length === 0) {
          newBadges.push('first_cook');
        }
      }
    } catch (pointsError) {
      // Points system not live yet - gracefully continue
      console.log('[cook/complete] Points system not available:', pointsError);
    }

    return NextResponse.json({
      ok: true,
      pointsAwarded,
      newBadges,
    });
  } catch (error) {
    console.error('[cook/complete] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
