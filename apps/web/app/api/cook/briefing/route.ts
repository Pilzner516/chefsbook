import { NextRequest, NextResponse } from 'next/server';
import { getCookingSession } from '@chefsbook/db';
import { generateChefBriefing } from '@chefsbook/ai';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId } = body as { sessionId: string };

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing sessionId' },
        { status: 400 }
      );
    }

    // Fetch the cooking session
    const session = await getCookingSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Generate briefing from the session's plan
    const briefing = await generateChefBriefing(session.plan);

    return NextResponse.json({ briefing });
  } catch (error) {
    console.error('[cook/briefing] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate briefing' },
      { status: 500 }
    );
  }
}
