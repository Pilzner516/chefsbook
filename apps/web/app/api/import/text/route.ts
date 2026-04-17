import { importFromText, consumeLastUsage, detectLanguage, translateRecipeContent } from '@chefsbook/ai';
import { logAiCall } from '@chefsbook/db';

export async function POST(req: Request) {
  try {
    const { text, userLanguage } = await req.json();

    if (!text || typeof text !== 'string' || text.trim().length < 10) {
      return Response.json({ error: 'Please paste at least a few lines of recipe text' }, { status: 400 });
    }

    const t0 = Date.now();
    const recipe = await importFromText(text);
    const u = consumeLastUsage();

    logAiCall({
      userId: null,
      action: 'import_text',
      model: 'sonnet',
      tokensIn: u?.inputTokens,
      tokensOut: u?.outputTokens,
      durationMs: Date.now() - t0,
      success: true,
    }).catch(() => {});

    // Translate if needed
    const targetLang = userLanguage ?? 'en';
    let sourceLanguage = 'en';
    try {
      const sample = `${recipe.title ?? ''} ${(recipe.ingredients ?? []).slice(0, 3).map((i: any) => i.ingredient ?? '').join(' ')}`;
      sourceLanguage = await detectLanguage(sample);
      if (sourceLanguage !== targetLang) {
        const translated = await translateRecipeContent(recipe as any, targetLang, sourceLanguage);
        Object.assign(recipe, translated);
      }
    } catch { /* translation failure non-blocking */ }

    (recipe as any).source_language = sourceLanguage;
    if (sourceLanguage !== targetLang) (recipe as any).translated_from = sourceLanguage;

    return Response.json({
      contentType: 'recipe',
      recipe,
      completeness: {
        source: 'text-paste',
        complete: !!recipe.title && (recipe.ingredients?.length ?? 0) >= 2 && (recipe.steps?.length ?? 0) >= 1,
        missing_fields: [
          ...(!recipe.title ? ['title'] : []),
          ...((recipe.ingredients?.length ?? 0) < 2 ? ['ingredients'] : []),
          ...((recipe.steps?.length ?? 0) < 1 ? ['steps'] : []),
        ],
      },
    });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
