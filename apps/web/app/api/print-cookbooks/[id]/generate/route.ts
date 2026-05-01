import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, listRecipePhotos, PLAN_LIMITS } from '@chefsbook/db';
import type { PlanTier, RecipeWithDetails } from '@chefsbook/db';
import { renderToBuffer } from '@react-pdf/renderer';
import React from 'react';
import sharp from 'sharp';
import Replicate from 'replicate';
import { CookbookCoverDocument } from './CookbookPdf';
import { TemplateEngine } from '@/lib/pdf-templates/engine';
import type { CookbookPdfOptions, CookbookRecipe, CoverStyle } from '@/lib/pdf-templates/types';
import type { ProductOptions } from '@/lib/lulu';
import type { BookLayout, RecipeCard, CoverCard, ForewordCard, BookLocale } from '@/lib/book-layout';
import { calculateQuality, type PrintUsage } from '@/lib/print-quality';

const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN ?? '';

// Chef hat icon for PDF branding
const CHEF_HAT_PATH = '/images/chefs-hat.png';

// DPI thresholds (matching print-quality.ts)
const EXCELLENT_DPI = 300;

// Initialize Replicate client
const replicate = REPLICATE_API_TOKEN ? new Replicate({ auth: REPLICATE_API_TOKEN }) : null;

// Cost per Real-ESRGAN upscale (approximate)
const UPSCALE_COST_USD = 0.002;

// Convert internal Tailscale URLs to public URLs for Replicate
// Replicate servers can't reach 100.110.47.62 - they need api.chefsbk.app
function toPublicUrl(url: string): string {
  // Replace Tailscale IP with public domain
  return url
    .replace('http://100.110.47.62:8000', 'https://api.chefsbk.app')
    .replace('http://localhost:8000', 'https://api.chefsbk.app');
}

// Generate a signed URL for Replicate (external servers can't use apikey header)
async function getSignedUrlForReplicate(imageUrl: string): Promise<string | null> {
  try {
    // Normalize URL and parse storage path
    // Expected format: .../storage/v1/object/public/{bucket}/{path}
    const normalized = imageUrl
      .replace('http://100.110.47.62:8000', 'https://api.chefsbk.app')
      .replace('http://localhost:8000', 'https://api.chefsbk.app');
    const urlObj = new URL(normalized);
    const pathMatch = urlObj.pathname.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/);

    if (!pathMatch) {
      console.warn('[Upscale] Could not parse storage path from URL:', imageUrl.substring(0, 80));
      return null;
    }

    const [, bucket, path] = pathMatch;

    // Create signed URL valid for 300 seconds
    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUrl(decodeURIComponent(path), 300);

    if (error || !data?.signedUrl) {
      console.warn('[Upscale] Failed to create signed URL:', error?.message);
      return null;
    }

    // Convert the signed URL to public domain
    return toPublicUrl(data.signedUrl);
  } catch (err) {
    console.warn('[Upscale] Error creating signed URL:', err);
    return null;
  }
}

// Upscale image using Real-ESRGAN via Replicate
async function upscaleImage(
  imageUrl: string,
  userId: string,
  cookbookId: string,
): Promise<{ upscaledBase64: string | null; upscaled: boolean }> {
  if (!replicate) {
    console.warn('[Upscale] Replicate API token not configured, skipping upscaling');
    return { upscaledBase64: null, upscaled: false };
  }

  try {
    // Generate a signed URL so Replicate can fetch without apikey header
    const signedUrl = await getSignedUrlForReplicate(imageUrl);
    if (!signedUrl) {
      console.warn('[Upscale] Could not generate signed URL, skipping upscaling');
      return { upscaledBase64: null, upscaled: false };
    }
    console.log('[Upscale] Upscaling image with signed URL');

    // Run Real-ESRGAN model
    const output = await replicate.run(
      'nightmareai/real-esrgan:42fed1c4974146d4d2414e2be2c5277c7fcf05fcc3a73abf41610695738c1d7b',
      { input: { image: signedUrl, scale: 4 } }
    );

    // Output is a URL to the upscaled image
    const upscaledUrl = output as unknown as string;
    if (!upscaledUrl || typeof upscaledUrl !== 'string') {
      console.warn('[Upscale] Unexpected output from Replicate:', output);
      return { upscaledBase64: null, upscaled: false };
    }

    // Fetch the upscaled image into memory (do NOT save to storage)
    const upscaledRes = await fetch(upscaledUrl);
    if (!upscaledRes.ok) {
      console.warn('[Upscale] Failed to fetch upscaled image:', upscaledRes.status);
      return { upscaledBase64: null, upscaled: false };
    }

    const upscaledBuf = await upscaledRes.arrayBuffer();
    const upscaledBase64 = Buffer.from(upscaledBuf).toString('base64');
    const contentType = upscaledRes.headers.get('content-type') ?? 'image/png';

    // Log cost to ai_usage_log
    try {
      await supabaseAdmin.from('ai_usage_log').insert({
        user_id: userId,
        action: 'print_upscale',
        model: 'real-esrgan-4x',
        cost_usd: UPSCALE_COST_USD,
        metadata: { cookbook_id: cookbookId },
        success: true,
      });
    } catch (logErr) {
      console.warn('[Upscale] Failed to log cost:', logErr);
    }

    console.log('[Upscale] Successfully upscaled image');
    return { upscaledBase64: `data:${contentType};base64,${upscaledBase64}`, upscaled: true };
  } catch (err) {
    console.error('[Upscale] Upscaling failed:', err);

    // Log failed attempt
    try {
      await supabaseAdmin.from('ai_usage_log').insert({
        user_id: userId,
        action: 'print_upscale',
        model: 'real-esrgan-4x',
        cost_usd: 0,
        metadata: { cookbook_id: cookbookId, error: err instanceof Error ? err.message : 'Unknown error' },
        success: false,
      });
    } catch {}

    return { upscaledBase64: null, upscaled: false };
  }
}

// Check if image needs upscaling based on DPI
async function needsUpscaling(imageBuffer: Buffer, usage: PrintUsage): Promise<boolean> {
  try {
    const metadata = await sharp(imageBuffer).metadata();
    if (!metadata.width || !metadata.height) return false;

    const quality = calculateQuality(metadata.width, metadata.height, usage);
    // Upscale if DPI is below excellent threshold
    return quality.dpi < EXCELLENT_DPI;
  } catch {
    return false;
  }
}

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

// Fetch image with upscaling support for print quality
async function fetchImageWithUpscaling(
  url: string,
  grayscale: boolean,
  usage: PrintUsage,
  userId: string,
  cookbookId: string,
): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { apikey: SUPABASE_ANON_KEY },
    });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const imageBuffer = Buffer.from(buf);

    // Check if image needs upscaling
    const shouldUpscale = await needsUpscaling(imageBuffer, usage);

    if (shouldUpscale && replicate) {
      // Upscale using Real-ESRGAN
      const { upscaledBase64, upscaled } = await upscaleImage(url, userId, cookbookId);
      if (upscaled && upscaledBase64) {
        // Apply grayscale to upscaled image if needed
        if (grayscale) {
          try {
            const base64Data = upscaledBase64.split(',')[1];
            const upscaledBuffer = Buffer.from(base64Data, 'base64');
            const grayBuffer = await sharp(upscaledBuffer)
              .grayscale()
              .jpeg({ quality: 90 })
              .toBuffer();
            return `data:image/jpeg;base64,${grayBuffer.toString('base64')}`;
          } catch {
            // Return upscaled without grayscale
            return upscaledBase64;
          }
        }
        return upscaledBase64;
      }
      // Fall back to original if upscaling fails
      console.log('[Generate PDF] Upscaling failed, using original image');
    }

    // No upscaling needed or Replicate not configured - use original
    if (grayscale) {
      try {
        const grayBuffer = await sharp(imageBuffer)
          .grayscale()
          .jpeg({ quality: 90 })
          .toBuffer();
        return `data:image/jpeg;base64,${grayBuffer.toString('base64')}`;
      } catch {
        // Fall back to original if sharp fails
      }
    }

    const base64 = imageBuffer.toString('base64');
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
    return NextResponse.json({ error: 'upgrade_required' }, { status: 403 });
  }

  // Parse product options from request body
  let productOptions: ProductOptions | null = null;
  let isPreview = false;
  try {
    const body = await request.json();
    productOptions = body.productOptions ?? null;
    isPreview = body.preview === true;
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
    let recipeAllImageUrls: Record<string, string[]> = {};
    let coverInfo: { title: string; subtitle?: string; author: string; cover_style: CoverStyle; image_url?: string };
    let forewordText: string | undefined;
    let bookLanguage: BookLocale = 'en';

    // Track custom pages per recipe
    let recipeCustomPages: Record<string, Array<{ id: string; layout: string; image_url?: string; text?: string; caption?: string }>> = {};

    // Track fill zone data per recipe (from first content page)
    let recipeFillZones: Record<string, { fillType?: string; fillContent?: { quoteText?: string; quoteAttribution?: string; customText?: string; customImageUrl?: string } }> = {};

    if (bookLayout) {
      // Extract from book_layout cards
      const coverCard = bookLayout.cards.find((c): c is CoverCard => c.type === 'cover');
      const forewordCard = bookLayout.cards.find((c): c is ForewordCard => c.type === 'foreword');
      const recipeCards = bookLayout.cards.filter((c): c is RecipeCard => c.type === 'recipe');

      recipeIds = recipeCards.map((c) => c.recipe_id);
      bookLanguage = bookLayout.language ?? 'en';

      for (const card of recipeCards) {
        recipeDisplayNames[card.recipe_id] = card.display_name;
        // Collect ALL image pages for this recipe
        const imagePages = card.pages.filter((p) => p.kind === 'image');
        recipeAllImageUrls[card.recipe_id] = imagePages
          .map((p) => p.kind === 'image' ? p.image_url : undefined)
          .filter((url): url is string => !!url);
        // Keep first image for legacy compatibility
        if (imagePages.length > 0 && imagePages[0].kind === 'image') {
          recipeImageUrls[card.recipe_id] = imagePages[0].image_url;
        }
        // Collect custom pages for this recipe
        const customPages = card.pages.filter((p) => p.kind === 'custom');
        if (customPages.length > 0) {
          recipeCustomPages[card.recipe_id] = customPages.map((p) => {
            if (p.kind === 'custom') {
              return {
                id: p.id,
                layout: p.layout,
                image_url: p.image_url,
                text: p.text,
                caption: p.caption,
              };
            }
            return { id: p.id, layout: 'text_only' };
          });
        }
        // Extract fill zone from first content page
        const contentPage = card.pages.find((p) => p.kind === 'content');
        if (contentPage && contentPage.kind === 'content' && contentPage.fillType) {
          recipeFillZones[card.recipe_id] = {
            fillType: contentPage.fillType,
            fillContent: contentPage.fillContent,
          };
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
      console.log('[Generate PDF] Foreword card:', forewordCard);
      console.log('[Generate PDF] Foreword text:', forewordText);
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
      // Use supabaseAdmin to bypass RLS - getRecipe uses anon client which has no auth context here
      const { data: recipe } = await supabaseAdmin
        .from('recipes')
        .select('*')
        .eq('id', recipeId)
        .single();

      if (recipe) {
        // Fetch ingredients and steps
        const [{ data: ingredients }, { data: steps }] = await Promise.all([
          supabaseAdmin.from('recipe_ingredients').select('*').eq('recipe_id', recipeId).order('sort_order'),
          supabaseAdmin.from('recipe_steps').select('*').eq('recipe_id', recipeId).order('step_number'),
        ]);
        const recipeWithDetails = { ...recipe, ingredients: ingredients ?? [], steps: steps ?? [] };

        // Fetch all selected images for this recipe
        // Preview path — no upscaling (fast, no Replicate calls)
        // Print path — upscaling enabled for low-DPI images
        const imageUrls: string[] = [];
        try {
          // Check new format first (supports multiple images), then legacy (single image)
          const allUrls = bookLayout
            ? (recipeAllImageUrls[recipeId] || [])
            : (selectedImageUrls[recipeId] ? [selectedImageUrls[recipeId]] : []);

          for (const url of allUrls) {
            const base64 = isPreview
              ? await fetchImageAsBase64(url, useGrayscale) // Preview path — no upscaling
              : await fetchImageWithUpscaling(url, useGrayscale, 'full_bleed', userId, id); // Print path — upscaling enabled
            if (base64) imageUrls.push(base64);
          }
        } catch {
          // Continue without images
        }

        // Process custom pages for this recipe
        const customPagesForRecipe = recipeCustomPages[recipeId] || [];
        const processedCustomPages: Array<{ id: string; layout: 'image_only' | 'text_only' | 'image_and_text'; image_url?: string; text?: string; caption?: string }> = [];
        for (const cp of customPagesForRecipe) {
          let processedImageUrl: string | undefined;
          if (cp.image_url) {
            const base64 = isPreview
              ? await fetchImageAsBase64(cp.image_url, useGrayscale) // Preview path — no upscaling
              : await fetchImageWithUpscaling(cp.image_url, useGrayscale, 'full_bleed', userId, id); // Print path — upscaling enabled
            processedImageUrl = base64 ?? undefined;
          }
          processedCustomPages.push({
            id: cp.id,
            layout: cp.layout as 'image_only' | 'text_only' | 'image_and_text',
            image_url: processedImageUrl,
            text: cp.text,
            caption: cp.caption,
          });
        }

        // Use display_name from book_layout if available, otherwise recipe title
        const displayName = recipeDisplayNames[recipeId] || recipeWithDetails.title;

        // Get fill zone data for this recipe
        const fillZone = recipeFillZones[recipeId];

        cookbookRecipes.push({
          id: recipeWithDetails.id,
          title: displayName,
          description: recipeWithDetails.description ?? undefined,
          cuisine: recipeWithDetails.cuisine ?? undefined,
          course: recipeWithDetails.course ?? undefined,
          total_minutes: recipeWithDetails.total_minutes ?? undefined,
          servings: recipeWithDetails.servings ?? undefined,
          ingredients: recipeWithDetails.ingredients.map((ing: { quantity: number | null; unit: string | null; ingredient: string; preparation: string | null; optional: boolean | null; group_label: string | null }) => ({
            quantity: ing.quantity,
            unit: ing.unit,
            ingredient: ing.ingredient,
            preparation: ing.preparation,
            optional: ing.optional ?? false,
            group_label: ing.group_label,
          })),
          steps: recipeWithDetails.steps.map((step: { step_number: number; instruction: string; timer_minutes: number | null; group_label: string | null }) => ({
            step_number: step.step_number,
            instruction: step.instruction,
            timer_minutes: step.timer_minutes,
            group_label: step.group_label ?? null,
          })),
          notes: recipeWithDetails.notes ?? undefined,
          image_urls: imageUrls,
          custom_pages: processedCustomPages.length > 0 ? processedCustomPages : undefined,
          fillType: fillZone?.fillType as 'blank' | 'chefs_notes' | 'quote' | 'custom' | undefined,
          fillContent: fillZone?.fillContent,
        });
      }
    }

    // For preview mode, allow any number of recipes; for final generation, require minimum 5
    if (!isPreview && cookbookRecipes.length < 5) {
      await supabaseAdmin
        .from('printed_cookbooks')
        .update({ status: 'draft' })
        .eq('id', id);
      return NextResponse.json({ error: 'Could not fetch minimum 5 recipes' }, { status: 400 });
    }

    // Still need at least 1 recipe to generate anything
    if (cookbookRecipes.length < 1) {
      await supabaseAdmin
        .from('printed_cookbooks')
        .update({ status: 'draft' })
        .eq('id', id);
      return NextResponse.json({ error: 'Add at least one recipe to preview' }, { status: 400 });
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
    // Preview path — no upscaling; Print path — upscaling enabled
    let coverImageBase64: string | null = null;
    if (coverInfo.image_url) {
      try {
        coverImageBase64 = isPreview
          ? await fetchImageAsBase64(coverInfo.image_url, useGrayscale) // Preview path — no upscaling
          : await fetchImageWithUpscaling(coverInfo.image_url, useGrayscale, 'cover', userId, id); // Print path — upscaling enabled
      } catch {
        console.warn('Could not fetch cover image for PDF');
      }
    }

    // Fetch menu chapter data if organisation is 'by_menu'
    let menuChapters: Array<{
      menu_id: string;
      menu_title: string;
      occasion?: string;
      notes?: string;
      chapter_number: number;
      recipe_ids: string[];
    }> | undefined;

    if (bookLayout?.organisation === 'by_menu' && bookLayout.menu_chapter_ids?.length) {
      const { data: menus } = await supabaseAdmin
        .from('menus')
        .select('id, title, occasion, notes')
        .in('id', bookLayout.menu_chapter_ids);

      if (menus && menus.length > 0) {
        const { data: menuItems } = await supabaseAdmin
          .from('menu_items')
          .select('menu_id, recipe_id')
          .in('menu_id', bookLayout.menu_chapter_ids);

        menuChapters = bookLayout.menu_chapter_ids
          .map((menuId, idx) => {
            const menu = menus.find((m) => m.id === menuId);
            if (!menu) return null;
            return {
              menu_id: menu.id,
              menu_title: menu.title,
              occasion: menu.occasion || undefined,
              notes: menu.notes || undefined,
              chapter_number: idx + 1,
              recipe_ids: (menuItems || []).filter((i) => i.menu_id === menuId).map((i) => i.recipe_id),
            };
          })
          .filter((m): m is NonNullable<typeof m> => m !== null);
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
        pageSize: bookLayout?.pageSize ?? 'letter',
      },
      recipes: cookbookRecipes,
      chefsHatBase64,
      language: bookLanguage,
    };

    // Generate interior PDF using the appropriate template
    // TemplateEngine ensures fonts are registered before template use
    const TemplateDocument = TemplateEngine.getTemplate(coverInfo.cover_style);

    // Build TemplateContext from pdfOptions
    const context = TemplateEngine.buildContext(
      {
        cookbook: pdfOptions.cookbook,
        recipes: pdfOptions.recipes,
        chefsHatBase64: pdfOptions.chefsHatBase64,
        language: pdfOptions.language,
        organisation: bookLayout?.organisation,
        menuChapters,
      },
      pdfOptions.cookbook.pageSize ?? 'letter',
      coverInfo.cover_style,
      {
        isPreview: isPreview,
      }
    );

    // Render template as React element (not plain function call)
    // renderToBuffer expects React.ReactElement, not function result
    const interiorBuffer = await renderToBuffer(React.createElement(TemplateDocument, context));

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
