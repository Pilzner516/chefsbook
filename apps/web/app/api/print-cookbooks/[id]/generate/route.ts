import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, getRecipe, listRecipePhotos, PLAN_LIMITS } from '@chefsbook/db';
import type { PlanTier, RecipeWithDetails } from '@chefsbook/db';
import { renderToBuffer } from '@react-pdf/renderer';
import sharp from 'sharp';
import { CookbookCoverDocument } from './CookbookPdf';
import { TrattoriaDocument } from '@/lib/pdf-templates/trattoria';
import { StudioDocument } from '@/lib/pdf-templates/studio';
import { GardenDocument } from '@/lib/pdf-templates/garden';
import { HeritageDocument } from '@/lib/pdf-templates/heritage';
import { NordicDocument } from '@/lib/pdf-templates/nordic';
import { BBQDocument } from '@/lib/pdf-templates/bbq';
import type { CookbookPdfOptions, CookbookRecipe, CoverStyle } from '@/lib/pdf-templates/types';
import type { ProductOptions } from '@/lib/lulu';
import type { BookLayout, RecipeCard, CoverCard, ForewordCard, BookLocale } from '@/lib/book-layout';

const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';

// Chef hat icon for PDF branding
const CHEF_HAT_PATH = '/images/chefs-hat.png';

async function getUserFromRequest(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    // Use supabaseAdmin to verify JWT (anon client cannot validate tokens)
    const { data } = await supabaseAdmin.auth.getUser(token);
    return data.user?.id ?? null;
  }
  return null;
}

async function checkProPlan(userId: string): Promise<boolean> {
  const { data: profile } = await supabaseAdmin
    .from('user_profiles')
    .select('plan_tier')
    .eq('id', userId)
    .single();
  const plan = (profile?.plan_tier as PlanTier) ?? 'free';
  return PLAN_LIMITS[plan]?.canPrintCookbook ?? false;
}

async function fetchImageAsBase64(url: string, grayscale: boolean = false): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { apikey: SUPABASE_ANON_KEY },
    });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();

    // Convert to grayscale if requested (for B&W printing)
    if (grayscale) {
      try {
        const grayBuffer = await sharp(Buffer.from(buf))
          .grayscale()
          .jpeg({ quality: 90 })
          .toBuffer();
        const base64 = grayBuffer.toString('base64');
        return `data:image/jpeg;base64,${base64}`;
      } catch {
        // Fall back to original if sharp fails
      }
    }

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

  // Parse product options from request body
  let productOptions: ProductOptions | null = null;
  try {
    const body = await request.json();
    productOptions = body.productOptions ?? null;
  } catch {
    // No body or invalid JSON — use defaults
  }

  // Determine if we should convert images to grayscale
  const useGrayscale = productOptions?.interiorColor === 'bw';

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

  // Parse selected_image_urls from JSONB (legacy format)
  const selectedImageUrls: Record<string, string> = cookbook.selected_image_urls ?? {};

  // Parse book_layout if present (new visual editor format)
  const bookLayout = cookbook.book_layout as BookLayout | null;

  try {
    // Extract data from book_layout if available, otherwise use legacy columns
    let recipeIds: string[] = [];
    let recipeDisplayNames: Record<string, string> = {};
    let recipeImageUrls: Record<string, string | undefined> = {};
    let coverInfo: { title: string; subtitle?: string; author: string; cover_style: CoverStyle; image_url?: string };
    let forewordText: string | undefined;
    let bookLanguage: BookLocale = 'en';

    if (bookLayout) {
      // Extract from book_layout cards
      const coverCard = bookLayout.cards.find((c): c is CoverCard => c.type === 'cover');
      const forewordCard = bookLayout.cards.find((c): c is ForewordCard => c.type === 'foreword');
      const recipeCards = bookLayout.cards.filter((c): c is RecipeCard => c.type === 'recipe');

      recipeIds = recipeCards.map((c) => c.recipe_id);
      bookLanguage = bookLayout.language ?? 'en';

      for (const card of recipeCards) {
        recipeDisplayNames[card.recipe_id] = card.display_name;
        const imagePage = card.pages.find((p) => p.kind === 'image');
        if (imagePage && imagePage.kind === 'image') {
          recipeImageUrls[card.recipe_id] = imagePage.image_url;
        }
      }

      coverInfo = {
        title: coverCard?.title ?? cookbook.title,
        subtitle: coverCard?.subtitle,
        author: coverCard?.author ?? cookbook.author_name,
        cover_style: (coverCard?.cover_style ?? cookbook.cover_style ?? 'classic') as CoverStyle,
        image_url: coverCard?.image_url,
      };

      forewordText = forewordCard?.text;
    } else {
      // Use legacy columns
      recipeIds = cookbook.recipe_ids ?? [];
      coverInfo = {
        title: cookbook.title,
        subtitle: cookbook.subtitle || undefined,
        author: cookbook.author_name,
        cover_style: (cookbook.cover_style ?? 'classic') as CoverStyle,
        image_url: cookbook.cover_image_url || undefined,
      };
      forewordText = cookbook.foreword || undefined;
    }

    // Fetch all recipes and convert to CookbookRecipe format
    const cookbookRecipes: CookbookRecipe[] = [];

    for (const recipeId of recipeIds) {
      const recipe = await getRecipe(recipeId);
      if (recipe) {
        // Fetch the selected image
        const imageUrls: string[] = [];
        try {
          // Check new format first, then legacy
          const selectedUrl = bookLayout
            ? recipeImageUrls[recipeId]
            : selectedImageUrls[recipeId];

          if (selectedUrl) {
            const base64 = await fetchImageAsBase64(selectedUrl, useGrayscale);
            if (base64) imageUrls.push(base64);
          }
        } catch {
          // Continue without images
        }

        // Use display_name from book_layout if available, otherwise recipe title
        const displayName = recipeDisplayNames[recipeId] || recipe.title;

        cookbookRecipes.push({
          id: recipe.id,
          title: displayName,
          description: recipe.description ?? undefined,
          cuisine: recipe.cuisine ?? undefined,
          course: recipe.course ?? undefined,
          total_minutes: recipe.total_minutes ?? undefined,
          servings: recipe.servings ?? undefined,
          ingredients: recipe.ingredients.map((ing) => ({
            quantity: ing.quantity,
            unit: ing.unit,
            ingredient: ing.ingredient,
            preparation: ing.preparation,
            optional: ing.optional ?? false,
            group_label: ing.group_label,
          })),
          steps: recipe.steps.map((step) => ({
            step_number: step.step_number,
            instruction: step.instruction,
            timer_minutes: step.timer_minutes,
            group_label: step.group_label ?? null,
          })),
          notes: recipe.notes ?? undefined,
          image_urls: imageUrls,
        });
      }
    }

    if (cookbookRecipes.length < 5) {
      await supabaseAdmin
        .from('printed_cookbooks')
        .update({ status: 'draft' })
        .eq('id', id);
      return NextResponse.json({ error: 'Could not fetch minimum 5 recipes' }, { status: 400 });
    }

    // Calculate page count
    // Title page + blank + TOC (1 page per 25 recipes) + 2 pages per recipe + back page
    const tocPages = Math.ceil(cookbookRecipes.length / 25);
    const pageCount = 2 + tocPages + cookbookRecipes.length * 2 + 1;
    const spineWidth = calculateSpineWidth(pageCount);

    // Fetch chef hat icon for branding
    let chefsHatBase64: string | null = null;
    try {
      const hatRes = await fetch(`http://localhost:3000${CHEF_HAT_PATH}`);
      if (hatRes.ok) {
        const hatBuf = await hatRes.arrayBuffer();
        const hatBase64 = Buffer.from(hatBuf).toString('base64');
        const hatContentType = hatRes.headers.get('content-type') ?? 'image/png';
        chefsHatBase64 = `data:${hatContentType};base64,${hatBase64}`;
      }
    } catch {
      console.warn('Could not fetch chef hat icon for PDF');
    }

    // Fetch cover image and convert to base64 (react-pdf can't fetch auth-required URLs)
    let coverImageBase64: string | null = null;
    if (coverInfo.image_url) {
      try {
        coverImageBase64 = await fetchImageAsBase64(coverInfo.image_url, useGrayscale);
      } catch {
        console.warn('Could not fetch cover image for PDF');
      }
    }

    // Use coverInfo from book_layout or legacy columns
    const pdfOptions: CookbookPdfOptions = {
      cookbook: {
        title: coverInfo.title,
        subtitle: coverInfo.subtitle,
        author_name: coverInfo.author,
        cover_style: coverInfo.cover_style,
        cover_image_url: coverImageBase64 || undefined,
        selected_image_urls: cookbook.selected_image_urls || undefined,
        foreword: forewordText,
      },
      recipes: cookbookRecipes,
      chefsHatBase64,
      language: bookLanguage,
    };

    // Generate interior PDF using the appropriate template
    const templateMap: Record<CoverStyle, typeof TrattoriaDocument> = {
      classic: TrattoriaDocument,
      modern: StudioDocument,
      minimal: GardenDocument,
      heritage: HeritageDocument,
      nordic: NordicDocument,
      bbq: BBQDocument,
    };
    const TemplateDocument = templateMap[coverInfo.cover_style] ?? TrattoriaDocument;

    const interiorBuffer = await renderToBuffer(TemplateDocument(pdfOptions));

    // Generate cover PDF — per pdf-design.md
    // Map new templates to their base cover style for print cover generation
    const coverStyleMap: Record<CoverStyle, 'classic' | 'modern' | 'minimal'> = {
      classic: 'classic',
      modern: 'modern',
      minimal: 'minimal',
      heritage: 'classic',  // Heritage uses classic-style cover (warm, traditional)
      nordic: 'minimal',    // Nordic uses minimal-style cover (clean, white)
      bbq: 'modern',        // BBQ uses modern-style cover (dark, bold)
    };
    const coverBuffer = await renderToBuffer(
      CookbookCoverDocument({
        title: coverInfo.title,
        subtitle: coverInfo.subtitle,
        authorName: coverInfo.author,
        coverStyle: coverStyleMap[coverInfo.cover_style] ?? 'classic',
        pageCount,
        spineWidth,
        chefsHatBase64,
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
