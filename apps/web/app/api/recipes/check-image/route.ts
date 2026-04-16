import { checkImageForWatermarks } from '@chefsbook/ai';
import { logAiCall } from '@chefsbook/db';

export async function POST(req: Request) {
  try {
    const { imageBase64, mimeType } = await req.json();
    if (!imageBase64) {
      return Response.json({ error: 'imageBase64 required' }, { status: 400 });
    }

    const result = await checkImageForWatermarks(imageBase64, mimeType);

    logAiCall({ userId: null, action: 'check_watermark', model: 'haiku' }).catch(() => {});

    return Response.json(result);
  } catch (err: any) {
    // On failure, allow the upload (safe default)
    return Response.json({
      has_watermark: false,
      confidence: 0,
      detected_marks: [],
      risk_level: 'low',
    });
  }
}
