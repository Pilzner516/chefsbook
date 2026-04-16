import { callClaude, extractJSON, HAIKU } from './client';

export interface WatermarkCheckResult {
  has_watermark: boolean;
  confidence: number;
  detected_marks: string[];
  risk_level: 'low' | 'medium' | 'high';
}

/**
 * Analyze an image for watermarks, logos, or branding from commercial sites.
 * Uses Claude Vision (Haiku) — ~$0.005 per check.
 */
export async function checkImageForWatermarks(
  imageBase64: string,
  mimeType: string = 'image/jpeg',
): Promise<WatermarkCheckResult> {
  const prompt = `Analyze this image for watermarks, logos, or branding that indicates it came from a commercial recipe site or photo service.
Look for: text overlays, site names, photographer credits, Getty/Shutterstock/iStock logos, stock photo watermarks, or any other ownership marks.
Also check for: screenshots of other apps (visible UI elements like status bars, navigation), or clearly professional studio photography with visible studio branding.

Return ONLY valid JSON:
{"has_watermark": bool, "confidence": 0-100, "detected_marks": ["list of what you found"], "risk_level": "low"|"medium"|"high"}

Risk levels:
- "high": Clear watermark text, stock photo logo, or obvious screenshot of another app
- "medium": Subtle branding, professional photo that might be stock, or partial text overlay
- "low": No visible watermarks or branding detected`;

  try {
    const raw = await callClaude({
      prompt,
      imageBase64,
      imageMimeType: mimeType,
      model: HAIKU,
      maxTokens: 300,
    });
    const result = extractJSON<WatermarkCheckResult>(raw);
    return {
      has_watermark: !!result.has_watermark,
      confidence: Math.min(100, Math.max(0, result.confidence ?? 0)),
      detected_marks: Array.isArray(result.detected_marks) ? result.detected_marks : [],
      risk_level: ['low', 'medium', 'high'].includes(result.risk_level) ? result.risk_level : 'low',
    };
  } catch {
    // Safe default: allow upload on AI failure
    return { has_watermark: false, confidence: 0, detected_marks: [], risk_level: 'low' };
  }
}
