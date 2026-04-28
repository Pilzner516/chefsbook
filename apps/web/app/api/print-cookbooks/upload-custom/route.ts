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

// POST /api/print-cookbooks/upload-custom - Upload custom page image
export async function POST(request: NextRequest) {
  const userId = await getUserFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const cookbookId = formData.get('cookbook_id') as string | null;

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  // Validate user owns the cookbook
  if (cookbookId) {
    const { data: cookbook, error } = await supabaseAdmin
      .from('printed_cookbooks')
      .select('user_id')
      .eq('id', cookbookId)
      .single();

    if (error || cookbook?.user_id !== userId) {
      return NextResponse.json({ error: 'Cookbook not found' }, { status: 404 });
    }
  }

  // Convert to JPEG for consistency
  const rawBuffer = Buffer.from(await file.arrayBuffer());
  const jpegBuffer = await sharp(rawBuffer)
    .jpeg({ quality: 90 })
    .toBuffer();

  const path = `${userId}/custom-${Date.now()}.jpg`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from('cookbook-pdfs')
    .upload(path, jpegBuffer, {
      contentType: 'image/jpeg',
      upsert: true,
    });

  if (uploadError) {
    console.error('Custom image upload error:', uploadError);
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: urlData } = supabaseAdmin.storage
    .from('cookbook-pdfs')
    .getPublicUrl(path);

  return NextResponse.json({ url: urlData.publicUrl });
}
