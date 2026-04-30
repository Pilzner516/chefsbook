import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@chefsbook/db';
import JSZip from 'jszip';
import { TemplateEngine, type TemplateManifest } from '@/lib/pdf-templates/engine';

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

// GET /api/admin/templates - List all templates with manifest data
export async function GET(request: NextRequest) {
  const admin = await getAdminUser(request);
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get templates from DB
  const { data: dbTemplates, error } = await supabaseAdmin
    .from('cookbook_templates')
    .select('*')
    .order('is_system', { ascending: false })
    .order('name');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Merge DB data with system template manifests
  const systemManifests = TemplateEngine.listTemplates();

  const templates = dbTemplates.map(t => {
    const manifest = t.is_system
      ? systemManifests.find(m => m.id === t.id)
      : (t.manifest as TemplateManifest | null);

    return {
      id: t.id,
      name: t.name,
      description: t.description,
      is_system: t.is_system,
      status: t.status,
      supported_page_sizes: t.supported_page_sizes || manifest?.supportedPageSizes || ['letter'],
      lulu_compliant: t.lulu_compliant ?? manifest?.luluCompliant ?? false,
      thumbnail_url: t.thumbnail_url || t.preview_image_url,
      manifest: manifest || null,
      validation_errors: t.validation_errors,
      created_at: t.created_at,
      updated_at: t.updated_at,
    };
  });

  return NextResponse.json({ templates });
}

// POST /api/admin/templates/upload - Upload a new template ZIP
export async function POST(request: NextRequest) {
  const admin = await getAdminUser(request);
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Verify file is a ZIP by checking magic bytes
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const isZip = bytes[0] === 0x50 && bytes[1] === 0x4B; // PK signature

    if (!isZip) {
      return NextResponse.json({ error: 'File is not a valid ZIP archive' }, { status: 400 });
    }

    // Extract ZIP contents
    const zip = await JSZip.loadAsync(buffer);

    // Look for required files
    const componentFile = zip.file('component.tsx') || zip.file(/component\.tsx$/i)[0];
    const manifestFile = zip.file('manifest.json') || zip.file(/manifest\.json$/i)[0];
    const thumbnailFile = zip.file('thumbnail.png') || zip.file(/thumbnail\.png$/i)[0];

    if (!componentFile) {
      return NextResponse.json({
        error: 'Missing required file: component.tsx',
        errors: ['component.tsx not found in ZIP root']
      }, { status: 400 });
    }

    if (!manifestFile) {
      return NextResponse.json({
        error: 'Missing required file: manifest.json',
        errors: ['manifest.json not found in ZIP root']
      }, { status: 400 });
    }

    // Extract and parse manifest
    const manifestContent = await manifestFile.async('string');
    let manifest: TemplateManifest;

    try {
      manifest = JSON.parse(manifestContent);
    } catch {
      return NextResponse.json({
        error: 'Invalid manifest.json: not valid JSON',
        errors: ['manifest.json is not valid JSON']
      }, { status: 400 });
    }

    // Validate manifest structure
    const manifestErrors: string[] = [];
    if (!manifest.id || typeof manifest.id !== 'string') manifestErrors.push('manifest.id is required');
    if (!manifest.name || typeof manifest.name !== 'string') manifestErrors.push('manifest.name is required');
    if (!manifest.version) manifestErrors.push('manifest.version is required');
    if (!manifest.settings?.palette) manifestErrors.push('manifest.settings.palette is required');
    if (!manifest.settings?.fonts) manifestErrors.push('manifest.settings.fonts is required');

    if (manifestErrors.length > 0) {
      return NextResponse.json({
        error: 'Invalid manifest.json structure',
        errors: manifestErrors
      }, { status: 400 });
    }

    // Extract component code
    const componentCode = await componentFile.async('string');

    // Validate template code
    const validationResult = TemplateEngine.validate(componentCode);

    if (!validationResult.valid) {
      return NextResponse.json({
        error: 'Template validation failed',
        errors: validationResult.errors,
        validationResult
      }, { status: 400 });
    }

    // Generate unique ID if not provided or if it conflicts
    const templateId = manifest.id || `custom-${Date.now()}`;

    // Check for existing template with same ID
    const { data: existing } = await supabaseAdmin
      .from('cookbook_templates')
      .select('id')
      .eq('id', templateId)
      .single();

    if (existing) {
      return NextResponse.json({
        error: `Template with ID "${templateId}" already exists`,
        errors: [`Template ID conflict: ${templateId}`]
      }, { status: 400 });
    }

    // Upload thumbnail if present
    let thumbnailUrl: string | null = null;
    if (thumbnailFile) {
      const thumbnailBuffer = await thumbnailFile.async('arraybuffer');
      const storagePath = `cookbook-templates/${templateId}/thumbnail.png`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from('recipe-images')
        .upload(storagePath, thumbnailBuffer, {
          contentType: 'image/png',
          upsert: true,
        });

      if (!uploadError) {
        const { data: urlData } = supabaseAdmin.storage
          .from('recipe-images')
          .getPublicUrl(storagePath);
        thumbnailUrl = urlData.publicUrl;
      }
    }

    // Insert template into DB
    const { data: newTemplate, error: insertError } = await supabaseAdmin
      .from('cookbook_templates')
      .insert({
        id: templateId,
        name: manifest.name,
        description: manifest.description || '',
        category: 'Custom',
        is_system: false,
        status: 'draft',
        supported_page_sizes: manifest.supportedPageSizes || ['letter'],
        lulu_compliant: manifest.luluCompliant ?? false,
        manifest: manifest,
        component_code: componentCode,
        thumbnail_url: thumbnailUrl,
        created_by: admin.userId,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      id: newTemplate.id,
      template: newTemplate,
      validationResult,
      thumbnailUrl,
    });

  } catch (err) {
    console.error('Template upload error:', err);
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Upload failed'
    }, { status: 500 });
  }
}
