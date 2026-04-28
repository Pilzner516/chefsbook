import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@chefsbook/db';

async function getUserFromRequest(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const { data } = await supabaseAdmin.auth.getUser(token);
    return data.user?.id ?? null;
  }
  return null;
}

// POST /api/print-cookbooks/[id]/cover-image - Upload cover image
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const userId = await getUserFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify cookbook ownership
  const { data: cookbook, error: cookbookError } = await supabaseAdmin
    .from('printed_cookbooks')
    .select('id')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (cookbookError || !cookbook) {
    return NextResponse.json({ error: 'Cookbook not found' }, { status: 404 });
  }

  // Get the file from form data
  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  // Convert to buffer
  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `${userId}/${id}/cover.${ext}`;

  // Upload to storage
  const { error: uploadError } = await supabaseAdmin.storage
    .from('cookbook-pdfs')
    .upload(path, buffer, {
      contentType: file.type,
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

  // Update cookbook with cover image URL
  const { error: updateError } = await supabaseAdmin
    .from('printed_cookbooks')
    .update({ cover_image_url: urlData.publicUrl })
    .eq('id', id);

  if (updateError) {
    console.error('Update error:', updateError);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ url: urlData.publicUrl });
}

// DELETE /api/print-cookbooks/[id]/cover-image - Remove cover image
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const userId = await getUserFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify cookbook ownership
  const { data: cookbook, error: cookbookError } = await supabaseAdmin
    .from('printed_cookbooks')
    .select('cover_image_url')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (cookbookError || !cookbook) {
    return NextResponse.json({ error: 'Cookbook not found' }, { status: 404 });
  }

  // Delete from storage if exists
  if (cookbook.cover_image_url) {
    const pathMatch = cookbook.cover_image_url.match(/cookbook-pdfs\/(.+)$/);
    if (pathMatch) {
      await supabaseAdmin.storage.from('cookbook-pdfs').remove([pathMatch[1]]);
    }
  }

  // Clear cover_image_url in DB
  const { error: updateError } = await supabaseAdmin
    .from('printed_cookbooks')
    .update({ cover_image_url: null })
    .eq('id', id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
