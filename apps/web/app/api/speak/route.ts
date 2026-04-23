import { formatVoiceRecipe, consumeLastUsage, moderateCategoricalFields } from '@chefsbook/ai';
import { logAiCall } from '@chefsbook/db';

export async function POST(req: Request) {
  const { transcript } = await req.json();

  if (!transcript || typeof transcript !== 'string' || transcript.trim().length < 10) {
    return Response.json({ error: 'Transcript is too short' }, { status: 400 });
  }

  try {
    const t0 = Date.now();
    const recipe = await formatVoiceRecipe(transcript);
    if (!recipe) {
      return Response.json({ error: 'Could not extract a recipe from the transcript. Try speaking with more detail.' }, { status: 422 });
    }

    // Moderate categorical fields before returning
    try {
      const moderated = await moderateCategoricalFields(
        'pending-speak',
        'system',
        {
          tags: (recipe as any).tags,
          cuisine: (recipe as any).cuisine,
          course: (recipe as any).course,
        }
      );
      (recipe as any).tags = moderated.tags;
      (recipe as any).cuisine = moderated.cuisine ?? undefined;
      (recipe as any).course = moderated.course ?? undefined;
      if (moderated.removed.length > 0) {
        console.log('[speak] Moderation removed:', moderated.removed);
      }
    } catch (modErr) {
      console.error('[speak] Moderation failed:', modErr);
    }

    const u = consumeLastUsage();
    logAiCall({ userId: null, action: 'import_speak', model: 'sonnet', durationMs: Date.now() - t0, tokensIn: u?.inputTokens, tokensOut: u?.outputTokens, success: true }).catch(() => {});

    return Response.json({ recipe });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
