import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin, getRecipe, listRecipePhotos, PLAN_LIMITS } from '@chefsbook/db';
import type { PlanTier, RecipeWithDetails } from '@chefsbook/db';
import { renderToBuffer } from '@react-pdf/renderer';
import { CookbookInteriorDocument, CookbookCoverDocument } from './CookbookPdf';

const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';

async function getUserFromRequest(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const { data } = await supabase.auth.getUser(token);
    return data.user?.id ?? null;
  }
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

async function checkProPlan(userId: string): Promise<boolean> {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('plan_tier')
    .eq('id', userId)
    .single();
  const plan = (profile?.plan_tier as PlanTier) ?? 'free';
  return PLAN_LIMITS[plan]?.canPrintCookbook ?? false;
}

async function fetchImageAsBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { apikey: SUPABASE_ANON_KEY },
    });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const base64 = Buffer.from(buf).toString('base64');
    const contentType = res.headers.get('content-type') ?? 'image/jpeg';
    return `data:${contentType};base64,${base64}`;
  } catch {
    return null;
  }
}

// Spine width calculation (based on page count)
// Lulu's formula: approximately 0.002252" per page for standard paper
function calculateSpineWidth(pageCount: number): number {
  const inchesPerPage = 0.002252;
  const spineInches = pageCount * inchesPerPage;
  return Math.max(spineInches * 72, 12); // Convert to points, minimum 12pt
}

// POST /api/print-cookbooks/[id]/generate - Generate PDFs
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const userId = await getUserFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const canPrint = await checkProPlan(userId);
  if (!canPrint) {
    return NextResponse.json({ error: 'Pro plan required' }, { status: 403 });
  }

  // Get the cookbook
  const { data: cookbook, error: cookbookError } = await supabaseAdmin
    .from('printed_cookbooks')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (cookbookError || !cookbook) {
    return NextResponse.json({ error: 'Cookbook not found' }, { status: 404 });
  }

  if (cookbook.status === 'ordered') {
    return NextResponse.json({ error: 'Cannot regenerate an ordered cookbook' }, { status: 400 });
  }

  // Update status to generating
  await supabaseAdmin
    .from('printed_cookbooks')
    .update({ status: 'generating' })
    .eq('id', id);

  try {
    // Fetch all recipes
    const recipes: RecipeWithDetails[] = [];
    const recipeImages: Record<string, string | null> = {};

    for (const recipeId of cookbook.recipe_ids) {
      const recipe = await getRecipe(recipeId);
      if (recipe) {
        recipes.push(recipe);

        // Fetch primary image
        try {
          const photos = await listRecipePhotos(recipeId);
          const photoUrl = photos.length > 0 ? photos[0].url : recipe.image_url;
          if (photoUrl) {
            recipeImages[recipe.id] = await fetchImageAsBase64(photoUrl);
          } else {
            recipeImages[recipe.id] = null;
          }
        } catch {
          recipeImages[recipe.id] = null;
        }
      }
    }

    if (recipes.length < 5) {
      await supabaseAdmin
        .from('printed_cookbooks')
        .update({ status: 'draft' })
        .eq('id', id);
      return NextResponse.json({ error: 'Could not fetch minimum 5 recipes' }, { status: 400 });
    }

    // Calculate page count
    // Title page + blank + TOC (1 page per 25 recipes) + 2 pages per recipe + back page
    const tocPages = Math.ceil(recipes.length / 25);
    const pageCount = 2 + tocPages + recipes.length * 2 + 1;
    const spineWidth = calculateSpineWidth(pageCount);

    // Generate interior PDF
    const interiorBuffer = await renderToBuffer(
      CookbookInteriorDocument({
        title: cookbook.title,
        subtitle: cookbook.subtitle || undefined,
        authorName: cookbook.author_name,
        recipes,
        recipeImages,
      }),
    );

    // Generate cover PDF
    const coverBuffer = await renderToBuffer(
      CookbookCoverDocument({
        title: cookbook.title,
        subtitle: cookbook.subtitle || undefined,
        authorName: cookbook.author_name,
        coverStyle: cookbook.cover_style as 'classic' | 'modern' | 'minimal',
        pageCount,
        spineWidth,
      }),
    );

    // Upload to Supabase Storage
    const interiorPath = `${userId}/${id}/interior.pdf`;
    const coverPath = `${userId}/${id}/cover.pdf`;

    const { error: interiorUploadError } = await supabaseAdmin.storage
      .from('cookbook-pdfs')
      .upload(interiorPath, interiorBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (interiorUploadError) {
      throw new Error(`Failed to upload interior PDF: ${interiorUploadError.message}`);
    }

    const { error: coverUploadError } = await supabaseAdmin.storage
      .from('cookbook-pdfs')
      .upload(coverPath, coverBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (coverUploadError) {
      throw new Error(`Failed to upload cover PDF: ${coverUploadError.message}`);
    }

    // Get public URLs
    const { data: interiorUrl } = supabaseAdmin.storage
      .from('cookbook-pdfs')
      .getPublicUrl(interiorPath);

    const { data: coverUrl } = supabaseAdmin.storage
      .from('cookbook-pdfs')
      .getPublicUrl(coverPath);

    // Update cookbook with URLs and page count
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('printed_cookbooks')
      .update({
        status: 'ready',
        interior_pdf_url: interiorUrl.publicUrl,
        cover_pdf_url: coverUrl.publicUrl,
        page_count: pageCount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to update cookbook: ${updateError.message}`);
    }

    return NextResponse.json({
      cookbook: updated,
      pageCount,
      spineWidthInches: (spineWidth / 72).toFixed(3),
    });
  } catch (error) {
    // Reset status on error
    await supabaseAdmin
      .from('printed_cookbooks')
      .update({ status: 'draft' })
      .eq('id', id);

    console.error('PDF generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'PDF generation failed' },
      { status: 500 },
    );
  }
}
