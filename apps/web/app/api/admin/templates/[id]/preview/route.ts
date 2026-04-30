import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@chefsbook/db';
import { renderToBuffer } from '@react-pdf/renderer';
import React from 'react';
import {
  TemplateEngine,
  TEST_RECIPE,
  isValidPageSize,
  type PageSizeKey,
} from '@/lib/pdf-templates/engine';

async function getAdminUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  if (!user) return null;

  const { data: adminRow } = await supabaseAdmin
    .from('admin_users')
    .select('role')
    .eq('user_id', user.id)
    .single();

  return adminRow ? user : null;
}

// GET /api/admin/templates/[id]/preview - Render template preview
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser(request);
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const pageSizeParam = searchParams.get('pageSize') || 'letter';
  const format = searchParams.get('format') || 'pdf';

  // Validate page size
  if (!isValidPageSize(pageSizeParam)) {
    return NextResponse.json({ error: 'Invalid page size' }, { status: 400 });
  }

  const pageSize = pageSizeParam as PageSizeKey;

  try {
    // Get template
    const { data: template, error } = await supabaseAdmin
      .from('cookbook_templates')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Get template component
    let TemplateComponent;

    if (template.is_system) {
      // Load from filesystem via TemplateEngine
      TemplateComponent = TemplateEngine.getTemplate(id);
    } else {
      // TODO: For uploaded templates, evaluate component_code safely
      // Phase 2 uses simple new Function() approach - needs hardening in Phase 3
      // For now, return error for non-system templates
      return NextResponse.json({
        error: 'Preview for custom templates not yet implemented'
      }, { status: 501 });
    }

    // Build context with test recipe
    const ctx = TemplateEngine.buildContext(
      {
        cookbook: {
          title: 'Preview Cookbook',
          subtitle: 'Template Preview',
          author_name: 'ChefsBook',
          cover_style: id as any,
          pageSize,
        },
        recipes: [TEST_RECIPE],
        language: 'en',
      },
      pageSize,
      id,
      { isPreview: true }
    );

    // Render to PDF buffer using React.createElement
    const pdfBuffer = await renderToBuffer(
      React.createElement(TemplateComponent, ctx)
    );

    // Convert Buffer to Uint8Array for NextResponse
    const uint8Array = new Uint8Array(pdfBuffer);

    if (format === 'pdf') {
      return new NextResponse(uint8Array, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${id}-preview-${pageSize}.pdf"`,
        },
      });
    }

    // For PNG format, we would need to convert PDF to image
    // This requires additional dependencies (pdf2pic, sharp, etc.)
    // For Phase 2, just return the PDF
    return new NextResponse(uint8Array, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${id}-preview-${pageSize}.pdf"`,
      },
    });

  } catch (err) {
    console.error('Template preview error:', err);
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Preview failed'
    }, { status: 500 });
  }
}
