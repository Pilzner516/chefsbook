import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@chefsbook/db';

async function getAdminUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  if (!user) return null;

  const { data: adminRow } = await supabaseAdmin
    .from('admin_users')
    .select('role, user_id')
    .eq('user_id', user.id)
    .single();

  return adminRow ? { ...adminRow, userId: user.id } : null;
}

// GET /api/admin/templates/[id] - Get single template
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser(request);
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const { data: template, error } = await supabaseAdmin
    .from('cookbook_templates')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !template) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }

  return NextResponse.json({ template });
}

// PATCH /api/admin/templates/[id] - Update template status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser(request);
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  // Get current template
  const { data: current, error: fetchError } = await supabaseAdmin
    .from('cookbook_templates')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !current) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }

  // Validate status transitions
  const newStatus = body.status as string | undefined;
  if (newStatus) {
    const validTransitions: Record<string, string[]> = {
      'active': ['inactive'],
      'inactive': ['active'],
      'draft': ['active', 'inactive'],
      'error': ['draft'],
    };

    const allowed = validTransitions[current.status] || [];
    if (!allowed.includes(newStatus)) {
      return NextResponse.json({
        error: `Invalid status transition from ${current.status} to ${newStatus}`
      }, { status: 400 });
    }
  }

  // Build updates
  const updates: Record<string, unknown> = {};

  if (newStatus) {
    updates.status = newStatus;
    // Also update is_active for backward compatibility
    updates.is_active = newStatus === 'active';
  }

  if (body.name) updates.name = body.name;
  if (body.description !== undefined) updates.description = body.description;

  updates.updated_at = new Date().toISOString();

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('cookbook_templates')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ template: updated });
}

// DELETE /api/admin/templates/[id] - Delete a template
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser(request);
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  // Get template to check if system
  const { data: template, error: fetchError } = await supabaseAdmin
    .from('cookbook_templates')
    .select('is_system, thumbnail_url')
    .eq('id', id)
    .single();

  if (fetchError || !template) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }

  if (template.is_system) {
    return NextResponse.json({
      error: 'System templates cannot be deleted. Disable them instead.'
    }, { status: 403 });
  }

  // Delete thumbnail from storage if exists
  if (template.thumbnail_url) {
    const storagePath = `cookbook-templates/${id}/thumbnail.png`;
    await supabaseAdmin.storage.from('recipe-images').remove([storagePath]);
  }

  // Delete template
  const { error: deleteError } = await supabaseAdmin
    .from('cookbook_templates')
    .delete()
    .eq('id', id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
