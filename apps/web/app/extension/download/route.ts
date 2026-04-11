import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { resolve } from 'path';

export async function GET() {
  try {
    const zipPath = resolve(process.cwd(), '../../apps/extension/dist/chefsbook-extension-v1.0.0.zip');
    const buffer = readFileSync(zipPath);
    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="chefsbook-extension.zip"',
        'Content-Length': String(buffer.length),
      },
    });
  } catch {
    return NextResponse.json({ error: 'Extension file not found' }, { status: 404 });
  }
}
