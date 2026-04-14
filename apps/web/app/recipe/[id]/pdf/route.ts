import { NextRequest, NextResponse } from 'next/server';
import { supabase, getRecipe, listRecipePhotos } from '@chefsbook/db';
import { PLAN_LIMITS } from '@chefsbook/db';
import type { PlanTier } from '@chefsbook/db';
import { renderToBuffer } from '@react-pdf/renderer';
import { RecipePdfDocument } from './RecipePdf';

const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Auth check
  const authHeader = request.headers.get('authorization');
  let userId: string | null = null;

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const { data } = await supabase.auth.getUser(token);
    userId = data.user?.id ?? null;
  } else {
    const { data: { session } } = await supabase.auth.getSession();
    userId = session?.user?.id ?? null;
  }

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Plan check
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('plan_tier')
    .eq('id', userId)
    .single();

  const plan = (profile?.plan_tier as PlanTier) ?? 'free';
  if (!PLAN_LIMITS[plan]?.canPDF) {
    return NextResponse.json({ error: 'Pro plan required for PDF export' }, { status: 403 });
  }

  // Fetch recipe
  const recipe = await getRecipe(id);
  if (!recipe) {
    return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
  }

  // Read options from query params
  const includeImage = request.nextUrl.searchParams.get('includeImage') !== 'false';
  const includeComments = request.nextUrl.searchParams.get('includeComments') !== 'false';

  // Fetch primary photo (recipe_user_photos first, then image_url fallback)
  let imageBase64: string | null = null;
  if (includeImage) {
    try {
      const photos = await listRecipePhotos(id);
      const photoUrl = photos.length > 0 ? photos[0].url : recipe.image_url;
      if (photoUrl) {
        imageBase64 = await fetchImageAsBase64(photoUrl);
      }
    } catch {
      // Image fetch failure should not block PDF generation
    }
  }

  // Generate PDF
  const pdfBuffer = await renderToBuffer(
    RecipePdfDocument({
      recipe,
      imageBase64,
      originalSubmitter: recipe.original_submitter_username ?? null,
      sharedBy: recipe.shared_by_username ?? null,
      includeComments,
    }),
  );

  const safeTitle = recipe.title.replace(/[/\\?%*:|"<>]/g, '-');

  return new Response(pdfBuffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="ChefsBook - ${safeTitle}.pdf"`,
    },
  });
}
