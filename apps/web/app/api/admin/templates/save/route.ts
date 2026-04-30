/**
 * POST /api/admin/templates/save
 *
 * Saves an AI-generated template to the database as a draft.
 * Admin-only endpoint.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@chefsbook/db';

export async function POST(req: NextRequest) {
  try {
    // Auth check
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.slice(7);

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Verify admin
    const { data: adminUser } = await supabaseAdmin
      .from('admin_users')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!adminUser) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Parse request
    const body = await req.json();
    const { code, manifest } = body;

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Code is required' }, { status: 400 });
    }

    if (!manifest || typeof manifest !== 'object') {
      return NextResponse.json({ error: 'Manifest is required' }, { status: 400 });
    }

    // Generate a unique ID if not provided
    const templateId = manifest.id || `ai-${Date.now()}`;

    // Check for existing template with same ID
    const { data: existing } = await supabaseAdmin
      .from('cookbook_templates')
      .select('id')
      .eq('id', templateId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'Template ID already exists' }, { status: 409 });
    }

    // Insert the template
    const { data: template, error: insertError } = await supabaseAdmin
      .from('cookbook_templates')
      .insert({
        id: templateId,
        name: manifest.name || 'Untitled Template',
        description: manifest.description || null,
        is_system: false,
        status: 'draft',
        supported_page_sizes: manifest.supportedPageSizes || ['letter', 'trade', 'large-trade', 'digest', 'square'],
        lulu_compliant: manifest.luluCompliant ?? true,
        manifest: manifest,
        component_code: code,
        created_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Template insert error:', insertError);
      return NextResponse.json({ error: 'Failed to save template' }, { status: 500 });
    }

    return NextResponse.json({ template });

  } catch (error) {
    console.error('Save template error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Save failed',
    }, { status: 500 });
  }
}
