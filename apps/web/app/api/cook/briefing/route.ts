import { NextRequest, NextResponse } from 'next/server';
import { getCookingSession } from '@chefsbook/db';
import { generateChefBriefing } from '@chefsbook/ai';

export async function POST(request: NextRequest) {
  console.log('[cook/briefing] Route called');
  try {
    const body = await request.json();
    const { sessionId } = body as { sessionId: string };
    console.log('[cook/briefing] SessionId:', sessionId);

    if (!sessionId) {
      console.error('[cook/briefing] Missing sessionId in request body');
      return NextResponse.json(
        { error: 'Missing sessionId' },
        { status: 400 }
      );
    }

    // Fetch the cooking session
    console.log('[cook/briefing] Fetching session from database...');
    const session = await getCookingSession(sessionId);
    if (!session) {
      console.error('[cook/briefing] Session not found:', sessionId);
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }
    console.log('[cook/briefing] Session found, plan:', JSON.stringify(session.plan).substring(0, 200));

    // Generate briefing from the session's plan
    console.log('[cook/briefing] Calling generateChefBriefing...');
    const briefing = await generateChefBriefing(session.plan);
    console.log('[cook/briefing] Briefing generated successfully:', briefing.substring(0, 100));

    return NextResponse.json({ briefing });
  } catch (error) {
    console.error('[cook/briefing] Error:', error);
    console.error('[cook/briefing] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json(
      { error: 'Failed to generate briefing' },
      { status: 500 }
    );
  }
}
