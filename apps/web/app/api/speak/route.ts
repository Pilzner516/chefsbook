import { formatVoiceRecipe } from '@chefsbook/ai';
import { logAiCall } from '@chefsbook/db';

export async function POST(req: Request) {
  const { transcript } = await req.json();

  if (!transcript || typeof transcript !== 'string' || transcript.trim().length < 10) {
    return Response.json({ error: 'Transcript is too short' }, { status: 400 });
  }

  try {
    const recipe = await formatVoiceRecipe(transcript);
    if (!recipe) {
      return Response.json({ error: 'Could not extract a recipe from the transcript. Try speaking with more detail.' }, { status: 422 });
    }

    logAiCall({ userId: null, action: 'import_speak', model: 'sonnet' }).catch(() => {});

    return Response.json({ recipe });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
