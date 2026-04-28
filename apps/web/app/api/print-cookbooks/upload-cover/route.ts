import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@chefsbook/db';
import sharp from 'sharp';

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

  // Convert to buffer and then to JPEG (bucket may reject PNG)
  const rawBuffer = Buffer.from(await file.arrayBuffer());
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
