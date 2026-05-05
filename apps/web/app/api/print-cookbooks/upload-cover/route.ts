import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@chefsbook/db';
import sharp from 'sharp';
import { scanFile } from '@/lib/scanFile';

async function getUserFromRequest(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const { data } = await supabaseAdmin.auth.getUser(token);
    return data.user?.id ?? null;
  }
  return null;
}

// POST /api/print-cookbooks/upload-cover - Upload cover image
export async function POST(request: NextRequest) {
  const userId = await getUserFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get the file from form data
  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  // Scan file for viruses and validate MIME type
  const rawBuffer = Buffer.from(await file.arrayBuffer());
  const scan = await scanFile(rawBuffer, file.type);

  if (!scan.ok) {
    if (scan.reason === 'too_large') {
      return NextResponse.json({ error: 'File too large (max 20 MB)' }, { status: 413 });
    }
    if (scan.reason === 'bad_mime') {
      return NextResponse.json({ error: 'File type not allowed' }, { status: 422 });
    }
    if (scan.reason === 'virus_detected') {
      return NextResponse.json({ error: 'File rejected for security reasons' }, { status: 422 });
    }
    // scan_error falls through (graceful degradation already handled in scanFile)
  }

  // Convert to buffer and then to JPEG (bucket may reject PNG)
  const jpegBuffer = await sharp(rawBuffer)
    .jpeg({ quality: 90 })
    .toBuffer();

  const path = `${userId}/cover-${Date.now()}.jpg`;

  // Upload to storage as JPEG
  const { error: uploadError } = await supabaseAdmin.storage
    .from('cookbook-pdfs')
    .upload(path, jpegBuffer, {
      contentType: 'image/jpeg',
      upsert: true,
    });

  if (uploadError) {
    console.error('Cover upload error:', uploadError);
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  // Get public URL
  const { data: urlData } = supabaseAdmin.storage
    .from('cookbook-pdfs')
    .getPublicUrl(path);

  return NextResponse.json({ url: urlData.publicUrl });
}
