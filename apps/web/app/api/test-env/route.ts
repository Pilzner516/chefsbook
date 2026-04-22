import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  return Response.json({
    hasExpoPublicKey: !!process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY,
    hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
    expoKeyPrefix: process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY?.substring(0, 20) || 'not set',
    anthropicKeyPrefix: process.env.ANTHROPIC_API_KEY?.substring(0, 20) || 'not set',
  });
}
