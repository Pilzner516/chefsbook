'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase, PLAN_LIMITS, getPrimaryPhotos, listRecipePhotos } from '@chefsbook/db';
import type { PlanTier } from '@chefsbook/db';
import { proxyIfNeeded } from '@/lib/recipeImage';
import { PRODUCT_OPTIONS, getDefaultProductOptions, type ProductOptions } from '@/lib/lulu';

type Step = 'select' | 'images' | 'details' | 'options' | 'preview' | 'order' | 'confirm';

interface RecipePreview {
  id: string;
  title: string;
  cuisine: string | null;
  total_minutes: number | null;
  servings: number | null;
  image_url: string | null;
}

type CoverStyle = 'classic' | 'modern' | 'minimal' | 'heritage' | 'nordic' | 'bbq';

interface PrintedCookbook {
  id: string;
  title: string;
  subtitle?: string;
  author_name: string;
  cover_style: CoverStyle;
  recipe_ids: string[];
  status: string;
  page_count?: number;
  interior_pdf_url?: string;
  cover_pdf_url?: string;
}

interface PricingInfo {
  lulu_cost_cents: number;
  shipping_cost_cents: number;
  our_margin_cents: number;
  total_cents: number;
  quantity: number;
  page_count: number;
  mock?: boolean;
}

export default function PrintCookbookPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [session, setSession] = useState<{ access_token: string } | null>(null);
  const [planTier, setPlanTier] = useState<PlanTier>('free');
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>('select');

  // Step 1: Recipe selection
  const [recipes, setRecipes] = useState<RecipePreview[]>([]);
  const [primaryPhotos, setPrimaryPhotos] = useState<Record<string, string>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [recipesLoading, setRecipesLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'title' | 'recent'>('title');

  // Step 2: Book details
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [coverStyle, setCoverStyle] = useState<CoverStyle>('classic');
  const [foreword, setForeword] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [coverImageUploading, setCoverImageUploading] = useState(false);

  // Step 1.5: Per-recipe image selection
  const [recipeImages, setRecipeImages] = useState<Record<string, { url: string; id: string }[]>>({});
  const [selectedImageUrls, setSelectedImageUrls] = useState<Record<string, string>>({});
  const [imagesLoading, setImagesLoading] = useState(false);

  // Step 3: Product options
  const [productOptions, setProductOptions] = useState<ProductOptions>(getDefaultProductOptions());
  const [estimatedPrice, setEstimatedPrice] = useState<number | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);

  // Step 4: Preview & Generate
  const [cookbook, setCookbook] = useState<PrintedCookbook | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState('');

  // Step 4: Order
  const [pricing, setPricing] = useState<PricingInfo | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [shippingLevel, setShippingLevel] = useState('GROUND');
  const [shippingAddress, setShippingAddress] = useState({
    name: '',
    street1: '',
    street2: '',
    city: '',
    state: '',
    postcode: '',
    country_code: 'US',
    phone: '',
  });
  const [ordering, setOrdering] = useState(false);
  const [orderError, setOrderError] = useState('');

  // Step 5: Confirmation
  const [orderId, setOrderId] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session: sess } } = await supabase.auth.getSession();
    if (!sess?.user) {
      router.push('/auth');
      return;
    }
    setUser(sess.user);
    setSession(sess);

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('plan_tier, display_name')
      .eq('id', sess.user.id)
      .single();

    setPlanTier((profile?.plan_tier as PlanTier) || 'free');
    if (profile?.display_name) {
      setAuthorName(profile.display_name);
    }
    setLoading(false);
    loadRecipes(sess.user.id, sortBy);
  };

  // Reload recipes when sort changes
  useEffect(() => {
    if (user) {
      loadRecipes(user.id, sortBy);
    }
  }, [sortBy]);

  const loadRecipes = async (userId: string, sort: 'title' | 'recent' = 'title') => {
    setRecipesLoading(true);
    let query = supabase
      .from('recipes')
      .select('id, title, cuisine, total_minutes, servings, image_url')
      .eq('user_id', userId);

    if (sort === 'recent') {
      query = query.order('created_at', { ascending: false });
    } else {
      query = query.order('title');
    }

    const { data } = await query;
    const recipeList = data || [];
    setRecipes(recipeList);

    // Fetch primary photos from recipe_user_photos table
    if (recipeList.length > 0) {
      const photos = await getPrimaryPhotos(recipeList.map((r) => r.id));
      setPrimaryPhotos(photos);
    }

    setRecipesLoading(false);
  };

  const canPrintCookbook = PLAN_LIMITS[planTier]?.canPrintCookbook ?? false;

  const toggleRecipe = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const loadRecipeImages = async () => {
    setImagesLoading(true);
    const imagesMap: Record<string, { url: string; id: string }[]> = {};
    const defaultSelections: Record<string, string> = {};

    for (const recipeId of selectedIds) {
      try {
        const photos = await listRecipePhotos(recipeId);
        if (photos.length > 0) {
          imagesMap[recipeId] = photos.map((p) => ({ url: p.url, id: p.id }));
          // Default to primary (first) image
          const primary = photos.find((p) => p.is_primary) ?? photos[0];
          if (primary) {
            defaultSelections[recipeId] = primary.url;
          }
        }
      } catch {
        // No images available
      }
    }

    setRecipeImages(imagesMap);
    setSelectedImageUrls(defaultSelections);
    setImagesLoading(false);
  };

  const handleCoverImageUpload = async (file: File) => {
    if (!user || !session) {
      setGenerateError('Not authenticated - please refresh the page');
      return;
    }
    setCoverImageUploading(true);
    setGenerateError('');
    try {
      const formData = new FormData();
      formData.append('file', file);

      const uploadRes = await fetch('/api/print-cookbooks/upload-cover', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      if (!uploadRes.ok) {
        const errData = await uploadRes.json().catch(() => ({}));
        throw new Error(errData.error || `Upload failed: ${uploadRes.status}`);
      }

      const { url } = await uploadRes.json();
      setCoverImageUrl(url);
    } catch (err: any) {
      console.error('Cover upload failed:', err);
      setGenerateError(`Failed to upload cover image: ${err.message || 'Unknown error'}`);
    } finally {
      setCoverImageUploading(false);
    }
  };

  const handleCreateCookbook = async () => {
    if (!title.trim() || !authorName.trim()) return;
    if (selectedIds.length < 5) return;

    setGenerating(true);
    setGenerateError('');

    try {
      // Create the cookbook draft
      const createRes = await fetch('/api/print-cookbooks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          subtitle: subtitle.trim() || null,
          author_name: authorName.trim(),
          cover_style: coverStyle,
          recipe_ids: selectedIds,
          foreword: foreword.trim() || null,
          cover_image_url: coverImageUrl,
          selected_image_urls: selectedImageUrls,
        }),
      });

      if (!createRes.ok) {
        const err = await createRes.json();
        throw new Error(err.error || 'Failed to create cookbook');
      }

      const { cookbook: created } = await createRes.json();
      setCookbook(created);

      // Generate the PDFs
      const genRes = await fetch(`/api/print-cookbooks/${created.id}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ productOptions }),
      });

      if (!genRes.ok) {
        const err = await genRes.json();
        throw new Error(err.error || 'Failed to generate PDFs');
      }

      const { cookbook: generated } = await genRes.json();
      setCookbook(generated);
      setStep('preview');
    } catch (e: any) {
      setGenerateError(e.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleGetPricing = async () => {
    if (!cookbook) return;

    setOrderError('');
    try {
      const res = await fetch(`/api/print-cookbooks/${cookbook.id}/price`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          quantity,
          shipping_name: shippingAddress.name,
          shipping_street1: shippingAddress.street1,
          shipping_street2: shippingAddress.street2,
          shipping_city: shippingAddress.city,
          shipping_state: shippingAddress.state,
          shipping_postcode: shippingAddress.postcode,
          shipping_country_code: shippingAddress.country_code,
          shipping_phone: shippingAddress.phone,
          shipping_level: shippingLevel,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to get pricing');
      }

      const { pricing: p } = await res.json();
      setPricing(p);
    } catch (e: any) {
      setOrderError(e.message);
    }
  };

  const handlePlaceOrder = async () => {
    if (!cookbook || !pricing) return;

    setOrdering(true);
    setOrderError('');

    try {
      // Create the order and get Stripe payment intent
      const res = await fetch(`/api/print-cookbooks/${cookbook.id}/order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          quantity,
          shipping_name: shippingAddress.name,
          shipping_street1: shippingAddress.street1,
          shipping_street2: shippingAddress.street2,
          shipping_city: shippingAddress.city,
          shipping_state: shippingAddress.state,
          shipping_postcode: shippingAddress.postcode,
          shipping_country_code: shippingAddress.country_code,
          shipping_phone: shippingAddress.phone,
          shipping_level: shippingLevel,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create order');
      }

      const { order_id } = await res.json();
      setOrderId(order_id);

      // For now, simulate payment success and submit to Lulu
      // In production, integrate Stripe Elements here
      // ...then mark payment complete and submit

      // Submit to Lulu (mock for now)
      const submitRes = await fetch(`/api/print-cookbooks/${cookbook.id}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ order_id }),
      });

      if (!submitRes.ok) {
        const err = await submitRes.json();
        throw new Error(err.error || 'Failed to submit order');
      }

      setStep('confirm');
    } catch (e: any) {
      setOrderError(e.message);
    } finally {
      setOrdering(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center text-cb-secondary py-20">Loading...</div>
      </div>
    );
  }

  // Pro plan gate
  if (!canPrintCookbook) {
    return (
      <div className="p-8">
        <div className="max-w-lg mx-auto text-center py-20">
          <div className="w-20 h-20 rounded-full bg-cb-primary/10 flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-cb-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold mb-3">Print Your Cookbook</h1>
          <p className="text-cb-secondary mb-6">
            Create a professionally printed cookbook with your favorite recipes.
            This feature is available on the Pro plan.
          </p>
          <Link
            href="/dashboard/plans"
            className="inline-flex items-center gap-2 bg-cb-primary text-white px-6 py-3 rounded-input font-semibold hover:opacity-90 transition-opacity"
          >
            Upgrade to Pro
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Print My Cookbook</h1>
        <p className="text-cb-secondary text-sm mt-1">
          Create a professionally printed cookbook with your favorite recipes.
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-2 mb-8">
        {(['select', 'images', 'details', 'options', 'preview', 'order', 'confirm'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                step === s
                  ? 'bg-cb-primary text-white'
                  : i < ['select', 'images', 'details', 'options', 'preview', 'order', 'confirm'].indexOf(step)
                  ? 'bg-cb-green text-white'
                  : 'bg-cb-border text-cb-secondary'
              }`}
            >
              {i + 1}
            </div>
            {i < 6 && (
              <div
                className={`w-10 h-0.5 mx-1 ${
                  i < ['select', 'images', 'details', 'options', 'preview', 'order', 'confirm'].indexOf(step)
                    ? 'bg-cb-green'
                    : 'bg-cb-border'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Select Recipes */}
      {step === 'select' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Select Recipes</h2>
            <div className="flex items-center gap-4">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'title' | 'recent')}
                className="text-sm border border-cb-border rounded-input px-3 py-1.5 bg-cb-card focus:outline-none focus:border-cb-primary"
              >
                <option value="title">A–Z</option>
                <option value="recent">Most Recent</option>
              </select>
              <div className="text-sm text-cb-secondary">
                {selectedIds.length} selected (min 5, max 80)
              </div>
            </div>
          </div>

          {recipesLoading ? (
            <div className="text-center text-cb-secondary py-12">Loading recipes...</div>
          ) : recipes.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-cb-secondary mb-4">You don't have any recipes yet.</p>
              <Link href="/dashboard/scan" className="text-cb-primary hover:underline">
                Import your first recipe →
              </Link>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
                {recipes.map((recipe) => {
                  const selected = selectedIds.includes(recipe.id);
                  return (
                    <button
                      key={recipe.id}
                      onClick={() => toggleRecipe(recipe.id)}
                      className={`relative bg-cb-card border rounded-card p-3 text-left transition-all ${
                        selected
                          ? 'border-cb-primary ring-2 ring-cb-primary/20'
                          : 'border-cb-border hover:border-cb-primary/50'
                      }`}
                    >
                      {selected && (
                        <div className="absolute top-2 right-2 w-6 h-6 bg-cb-primary rounded-full flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                          </svg>
                        </div>
                      )}
                      {(primaryPhotos[recipe.id] || recipe.image_url) ? (
                        <div className="relative">
                          <img
                            src={proxyIfNeeded(primaryPhotos[recipe.id] || recipe.image_url!)}
                            alt=""
                            className="w-full h-24 object-cover rounded mb-2"
                          />
                          {!primaryPhotos[recipe.id] && recipe.image_url && (
                            <div className="absolute bottom-3 left-1 right-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1">
                              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
                              </svg>
                              Add your own photo
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="w-full h-24 bg-cb-bg rounded mb-2 flex items-center justify-center">
                          <svg className="w-8 h-8 text-cb-secondary/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                          </svg>
                        </div>
                      )}
                      <p className="font-medium text-sm truncate">{recipe.title}</p>
                      {recipe.cuisine && (
                        <p className="text-xs text-cb-secondary truncate">{recipe.cuisine}</p>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Selected recipes order panel */}
              {selectedIds.length > 0 && (
                <div className="mb-6 p-4 bg-cb-bg rounded-card border border-cb-border">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-sm">Recipe Order in Cookbook</h3>
                    <span className="text-xs text-cb-secondary">Drag to reorder or use arrows</span>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {selectedIds.map((id, idx) => {
                      const recipe = recipes.find(r => r.id === id);
                      if (!recipe) return null;
                      return (
                        <div key={id} className="flex items-center gap-2 bg-cb-card p-2 rounded-input border border-cb-border">
                          <span className="text-xs text-cb-muted w-6 text-center">{idx + 1}</span>
                          <span className="flex-1 text-sm truncate">{recipe.title}</span>
                          <div className="flex gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (idx > 0) {
                                  const newIds = [...selectedIds];
                                  [newIds[idx - 1], newIds[idx]] = [newIds[idx], newIds[idx - 1]];
                                  setSelectedIds(newIds);
                                }
                              }}
                              disabled={idx === 0}
                              className="p-1 hover:bg-cb-border rounded disabled:opacity-30"
                              title="Move up"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                              </svg>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (idx < selectedIds.length - 1) {
                                  const newIds = [...selectedIds];
                                  [newIds[idx], newIds[idx + 1]] = [newIds[idx + 1], newIds[idx]];
                                  setSelectedIds(newIds);
                                }
                              }}
                              disabled={idx === selectedIds.length - 1}
                              className="p-1 hover:bg-cb-border rounded disabled:opacity-30"
                              title="Move down"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                              </svg>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedIds(selectedIds.filter(i => i !== id));
                              }}
                              className="p-1 hover:bg-red-100 text-cb-primary rounded"
                              title="Remove"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={() => {
                    loadRecipeImages();
                    setStep('images');
                  }}
                  disabled={selectedIds.length < 5}
                  className="bg-cb-primary text-white px-6 py-2.5 rounded-input font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-2"
                >
                  Continue
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                  </svg>
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Step 1.5: Per-Recipe Image Selection */}
      {step === 'images' && (
        <div>
          <h2 className="text-lg font-semibold mb-2">Select Images for Recipes</h2>
          <p className="text-sm text-cb-secondary mb-6">
            Choose which image to use for each recipe in your cookbook. Recipes without images will use a styled text page.
          </p>

          {imagesLoading ? (
            <div className="text-center text-cb-secondary py-12">Loading images...</div>
          ) : (
            <>
              <div className="space-y-6 mb-6">
                {selectedIds.map((recipeId) => {
                  const recipe = recipes.find((r) => r.id === recipeId);
                  const images = recipeImages[recipeId] ?? [];
                  const selectedUrl = selectedImageUrls[recipeId];

                  return (
                    <div key={recipeId} className="bg-cb-card border border-cb-border rounded-card p-4">
                      <h3 className="font-medium mb-3">{recipe?.title ?? 'Unknown Recipe'}</h3>
                      {images.length === 0 ? (
                        <p className="text-sm text-cb-muted">No images available</p>
                      ) : (
                        <div className="flex gap-3 flex-wrap">
                          {/* No image option */}
                          <button
                            onClick={() => {
                              setSelectedImageUrls((prev) => {
                                const updated = { ...prev };
                                delete updated[recipeId];
                                return updated;
                              });
                            }}
                            className={`w-20 h-20 rounded-input border-2 flex items-center justify-center transition-all ${
                              !selectedUrl
                                ? 'border-cb-primary bg-cb-primary/5'
                                : 'border-cb-border hover:border-cb-primary/50'
                            }`}
                          >
                            <div className="text-center">
                              <svg className="w-6 h-6 mx-auto text-cb-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
                              </svg>
                              <span className="text-[10px] text-cb-muted">None</span>
                            </div>
                          </button>
                          {images.map((img) => (
                            <button
                              key={img.id}
                              onClick={() => {
                                setSelectedImageUrls((prev) => ({
                                  ...prev,
                                  [recipeId]: img.url,
                                }));
                              }}
                              className={`relative w-20 h-20 rounded-input border-2 overflow-hidden transition-all ${
                                selectedUrl === img.url
                                  ? 'border-cb-primary ring-2 ring-cb-primary/20'
                                  : 'border-cb-border hover:border-cb-primary/50'
                              }`}
                            >
                              <img
                                src={proxyIfNeeded(img.url)}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                              {selectedUrl === img.url && (
                                <div className="absolute top-1 right-1 w-5 h-5 bg-cb-primary rounded-full flex items-center justify-center">
                                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                                  </svg>
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between">
                <button
                  onClick={() => setStep('select')}
                  className="text-cb-secondary hover:text-cb-text transition-colors"
                >
                  ← Back
                </button>
                <button
                  onClick={() => setStep('details')}
                  className="bg-cb-primary text-white px-6 py-2.5 rounded-input font-semibold hover:opacity-90 transition-opacity flex items-center gap-2"
                >
                  Continue
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                  </svg>
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Step 2: Book Details */}
      {step === 'details' && (
        <div className="max-w-xl">
          <h2 className="text-lg font-semibold mb-4">Book Details</h2>

          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium mb-1">Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="My Family Recipes"
                maxLength={60}
                className="w-full bg-cb-bg border border-cb-border rounded-input px-4 py-3 text-sm outline-none focus:border-cb-primary transition-colors"
              />
              <p className="text-xs text-cb-secondary mt-1">{title.length}/60 characters</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Subtitle</label>
              <input
                type="text"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="A collection of treasured recipes"
                maxLength={80}
                className="w-full bg-cb-bg border border-cb-border rounded-input px-4 py-3 text-sm outline-none focus:border-cb-primary transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Author Name *</label>
              <input
                type="text"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder="Your name"
                className="w-full bg-cb-bg border border-cb-border rounded-input px-4 py-3 text-sm outline-none focus:border-cb-primary transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Foreword <span className="text-cb-muted font-normal">(optional)</span></label>
              <textarea
                value={foreword}
                onChange={(e) => setForeword(e.target.value.slice(0, 1000))}
                placeholder="Add a personal message, dedication, or introduction to your cookbook..."
                rows={4}
                className="w-full bg-cb-bg border border-cb-border rounded-input px-4 py-3 text-sm outline-none focus:border-cb-primary transition-colors resize-none"
              />
              <p className="text-xs text-cb-secondary mt-1">{foreword.length}/1000 characters</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Cover Image <span className="text-cb-muted font-normal">(optional)</span></label>
              <p className="text-xs text-cb-secondary mb-3">Upload a custom image for your cookbook cover. If not provided, a styled title page will be used.</p>
              {coverImageUrl ? (
                <div className="relative inline-block">
                  <img
                    src={proxyIfNeeded(coverImageUrl)}
                    alt="Cover preview"
                    className="w-40 h-52 object-cover rounded-card border border-cb-border"
                  />
                  <button
                    onClick={() => setCoverImageUrl(null)}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-cb-primary text-white rounded-full flex items-center justify-center hover:opacity-90"
                    title="Remove cover image"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <label className={`flex flex-col items-center justify-center w-40 h-52 border-2 border-dashed rounded-card cursor-pointer transition-colors ${coverImageUploading ? 'border-cb-primary bg-cb-primary/5' : 'border-cb-border hover:border-cb-primary/50'}`}>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleCoverImageUpload(file);
                    }}
                    disabled={coverImageUploading}
                  />
                  {coverImageUploading ? (
                    <svg className="animate-spin w-8 h-8 text-cb-primary" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : (
                    <>
                      <svg className="w-10 h-10 text-cb-secondary/40 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
                      </svg>
                      <span className="text-xs text-cb-secondary">Click to upload</span>
                    </>
                  )}
                </label>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Template Style</label>
              <div className="grid grid-cols-3 gap-4">
                {/* Trattoria (Classic) */}
                <button
                  onClick={() => setCoverStyle('classic')}
                  className={`p-3 rounded-card border text-left transition-all ${
                    coverStyle === 'classic'
                      ? 'border-cb-primary ring-2 ring-cb-primary/20'
                      : 'border-cb-border hover:border-cb-primary/50'
                  }`}
                >
                  <div className="w-full aspect-[3/4] rounded bg-[#faf7f0] mb-3 relative overflow-hidden">
                    <svg viewBox="0 0 120 160" className="w-full h-full">
                      <rect x="8" y="8" width="104" height="144" fill="none" stroke="#ce2b37" strokeWidth="1"/>
                      <text x="60" y="55" textAnchor="middle" fontFamily="serif" fontSize="10" fontWeight="bold" fill="#1a1a1a">My Cookbook</text>
                      <rect x="45" y="62" width="30" height="1" fill="#ce2b37"/>
                      <text x="60" y="78" textAnchor="middle" fontFamily="sans-serif" fontSize="5" fill="#7a6a5a">by Author Name</text>
                      <rect x="18" y="95" width="84" height="20" fill="#f0ece0" rx="2"/>
                      <rect x="18" y="120" width="40" height="28" fill="#f0ece0" rx="2"/>
                      <rect x="62" y="120" width="40" height="28" fill="#f0ece0" rx="2"/>
                    </svg>
                  </div>
                  <div className="font-semibold text-sm">Trattoria</div>
                  <div className="text-xs text-cb-secondary">Warm & rustic</div>
                </button>

                {/* Studio (Modern) */}
                <button
                  onClick={() => setCoverStyle('modern')}
                  className={`p-3 rounded-card border text-left transition-all ${
                    coverStyle === 'modern'
                      ? 'border-cb-primary ring-2 ring-cb-primary/20'
                      : 'border-cb-border hover:border-cb-primary/50'
                  }`}
                >
                  <div className="w-full aspect-[3/4] rounded bg-[#1a1a1a] mb-3 relative overflow-hidden">
                    <svg viewBox="0 0 120 160" className="w-full h-full">
                      <rect x="0" y="64" width="120" height="6" fill="#ce2b37"/>
                      <text x="60" y="55" textAnchor="middle" fontFamily="serif" fontSize="11" fontWeight="bold" fill="#f5f0e8">My Cookbook</text>
                      <text x="60" y="85" textAnchor="middle" fontFamily="sans-serif" fontSize="5" fill="#ce2b37">A Collection</text>
                      <text x="60" y="98" textAnchor="middle" fontFamily="sans-serif" fontSize="4" fill="rgba(245,240,232,0.5)">by Author Name</text>
                      <text x="25" y="140" fontFamily="serif" fontSize="28" fill="rgba(255,255,255,0.06)" fontWeight="bold">1</text>
                      <text x="70" y="140" fontFamily="serif" fontSize="28" fill="rgba(255,255,255,0.06)" fontWeight="bold">2</text>
                    </svg>
                  </div>
                  <div className="font-semibold text-sm">Studio</div>
                  <div className="text-xs text-cb-secondary">Dark & dramatic</div>
                </button>

                {/* Garden (Minimal) */}
                <button
                  onClick={() => setCoverStyle('minimal')}
                  className={`p-3 rounded-card border text-left transition-all ${
                    coverStyle === 'minimal'
                      ? 'border-cb-primary ring-2 ring-cb-primary/20'
                      : 'border-cb-border hover:border-cb-primary/50'
                  }`}
                >
                  <div className="w-full aspect-[3/4] rounded bg-white border border-cb-border mb-3 relative overflow-hidden">
                    <svg viewBox="0 0 120 160" className="w-full h-full">
                      <rect x="0" y="0" width="120" height="4" fill="#009246"/>
                      <text x="60" y="50" textAnchor="middle" fontFamily="sans-serif" fontSize="11" fontWeight="bold" fill="#1a1a1a">My Cookbook</text>
                      <rect x="50" y="56" width="20" height="2" fill="#009246"/>
                      <text x="60" y="74" textAnchor="middle" fontFamily="sans-serif" fontSize="5" fill="#9a8a7a">by Author Name</text>
                      <rect x="20" y="95" width="80" height="1" fill="#e8e0d0"/>
                      <text x="22" y="108" fontFamily="sans-serif" fontSize="4" fill="#009246">INGREDIENTS</text>
                      <rect x="20" y="112" width="30" height="1" fill="#009246"/>
                    </svg>
                  </div>
                  <div className="font-semibold text-sm">Garden</div>
                  <div className="text-xs text-cb-secondary">Clean & airy</div>
                </button>

                {/* Heritage (Farmhouse) */}
                <button
                  onClick={() => setCoverStyle('heritage')}
                  className={`p-3 rounded-card border text-left transition-all ${
                    coverStyle === 'heritage'
                      ? 'border-cb-primary ring-2 ring-cb-primary/20'
                      : 'border-cb-border hover:border-cb-primary/50'
                  }`}
                >
                  <div className="w-full aspect-[3/4] rounded bg-[#f8f5f0] mb-3 relative overflow-hidden">
                    <svg viewBox="0 0 120 160" className="w-full h-full">
                      {/* Double frame */}
                      <rect x="10" y="10" width="100" height="140" fill="none" stroke="#8b9a7d" strokeWidth="1"/>
                      <rect x="14" y="14" width="92" height="132" fill="none" stroke="#ddd5c8" strokeWidth="0.5"/>
                      {/* Decorative flourish */}
                      <line x1="40" y1="40" x2="80" y2="40" stroke="#8b9a7d" strokeWidth="0.5"/>
                      <circle cx="60" cy="40" r="2" fill="#8b9a7d"/>
                      <line x1="40" y1="40" x2="35" y2="40" stroke="#8b9a7d" strokeWidth="0.5"/>
                      <line x1="80" y1="40" x2="85" y2="40" stroke="#8b9a7d" strokeWidth="0.5"/>
                      {/* Title */}
                      <text x="60" y="60" textAnchor="middle" fontFamily="serif" fontSize="10" fontWeight="bold" fill="#3a3028">My Cookbook</text>
                      <rect x="50" y="66" width="20" height="1" fill="#6b5344"/>
                      <text x="60" y="82" textAnchor="middle" fontFamily="sans-serif" fontSize="5" fill="#9a8a7a">by Author Name</text>
                      {/* Two-column preview */}
                      <line x1="60" y1="95" x2="60" y2="145" stroke="#ddd5c8" strokeWidth="0.5"/>
                      <text x="35" y="105" textAnchor="middle" fontFamily="sans-serif" fontSize="3" fill="#8b9a7d">INGREDIENTS</text>
                      <text x="85" y="105" textAnchor="middle" fontFamily="sans-serif" fontSize="3" fill="#8b9a7d">DIRECTIONS</text>
                    </svg>
                  </div>
                  <div className="font-semibold text-sm">Heritage</div>
                  <div className="text-xs text-cb-secondary">Farmhouse charm</div>
                </button>

                {/* Nordic (Scandinavian) */}
                <button
                  onClick={() => setCoverStyle('nordic')}
                  className={`p-3 rounded-card border text-left transition-all ${
                    coverStyle === 'nordic'
                      ? 'border-cb-primary ring-2 ring-cb-primary/20'
                      : 'border-cb-border hover:border-cb-primary/50'
                  }`}
                >
                  <div className="w-full aspect-[3/4] rounded bg-white mb-3 relative overflow-hidden">
                    <svg viewBox="0 0 120 160" className="w-full h-full">
                      {/* Left accent panel */}
                      <rect x="0" y="0" width="40" height="160" fill="#f5f5f5"/>
                      {/* Title - bottom aligned like Noma */}
                      <text x="48" y="130" fontFamily="sans-serif" fontSize="12" fontWeight="bold" fill="#2d2d2d">My</text>
                      <text x="48" y="145" fontFamily="sans-serif" fontSize="12" fontWeight="bold" fill="#2d2d2d">Cookbook</text>
                      <text x="48" y="155" fontFamily="sans-serif" fontSize="4" fill="#5c7a8a">by Author Name</text>
                      {/* Blue accent */}
                      <rect x="0" y="0" width="4" height="160" fill="#5c7a8a"/>
                      {/* Step numbers preview */}
                      <text x="50" y="50" fontFamily="sans-serif" fontSize="8" fill="#5c7a8a">01</text>
                      <line x1="50" y1="55" x2="110" y2="55" stroke="#e0e0e0" strokeWidth="0.5"/>
                      <text x="50" y="70" fontFamily="sans-serif" fontSize="8" fill="#5c7a8a">02</text>
                      <line x1="50" y1="75" x2="110" y2="75" stroke="#e0e0e0" strokeWidth="0.5"/>
                    </svg>
                  </div>
                  <div className="font-semibold text-sm">Nordic</div>
                  <div className="text-xs text-cb-secondary">Stark & minimal</div>
                </button>

                {/* BBQ (Smokehouse) */}
                <button
                  onClick={() => setCoverStyle('bbq')}
                  className={`p-3 rounded-card border text-left transition-all ${
                    coverStyle === 'bbq'
                      ? 'border-cb-primary ring-2 ring-cb-primary/20'
                      : 'border-cb-border hover:border-cb-primary/50'
                  }`}
                >
                  <div className="w-full aspect-[3/4] rounded bg-[#2d2926] mb-3 relative overflow-hidden">
                    <svg viewBox="0 0 120 160" className="w-full h-full">
                      {/* Top amber stripe */}
                      <rect x="0" y="12" width="120" height="4" fill="#d4a03a"/>
                      {/* Bottom rust stripe */}
                      <rect x="0" y="144" width="120" height="4" fill="#b54b32"/>
                      {/* Title - bold uppercase */}
                      <text x="60" y="70" textAnchor="middle" fontFamily="sans-serif" fontSize="12" fontWeight="bold" fill="#fffdf8" letterSpacing="2">MY COOKBOOK</text>
                      <text x="60" y="84" textAnchor="middle" fontFamily="sans-serif" fontSize="6" fill="#d4a03a">A Collection</text>
                      {/* Amber divider */}
                      <rect x="40" y="92" width="40" height="2" fill="#d4a03a"/>
                      <text x="60" y="106" textAnchor="middle" fontFamily="sans-serif" fontSize="5" fill="#f5f0e8">by Author Name</text>
                      {/* Recipe preview - cream background */}
                      <rect x="15" y="115" width="90" height="30" fill="#f5f0e8"/>
                      {/* Charcoal step circle */}
                      <circle cx="28" cy="130" r="6" fill="#2d2926"/>
                      <text x="28" y="132" textAnchor="middle" fontFamily="sans-serif" fontSize="6" fill="#fffdf8" fontWeight="bold">1</text>
                      {/* Amber bullet */}
                      <rect x="80" y="122" width="4" height="4" fill="#d4a03a"/>
                      <rect x="80" y="130" width="4" height="4" fill="#d4a03a"/>
                    </svg>
                  </div>
                  <div className="font-semibold text-sm">BBQ</div>
                  <div className="text-xs text-cb-secondary">Bold & smoky</div>
                </button>
              </div>
            </div>
          </div>

          {generateError && (
            <div className="bg-red-50 border border-red-200 text-cb-primary rounded-input p-3 mb-4 text-sm">
              {generateError}
            </div>
          )}

          <div className="flex items-center justify-between">
            <button
              onClick={() => setStep('images')}
              className="text-cb-secondary hover:text-cb-text transition-colors"
            >
              ← Back
            </button>
            <button
              onClick={() => setStep('options')}
              disabled={!title.trim() || !authorName.trim()}
              className="bg-cb-primary text-white px-6 py-2.5 rounded-input font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-2"
            >
              Choose Print Options
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Product Options */}
      {step === 'options' && (
        <div className="max-w-2xl">
          <h2 className="text-lg font-semibold mb-2">Print Options</h2>
          <p className="text-sm text-cb-secondary mb-6">
            Customize your printed cookbook. Prices update as you select options.
          </p>

          <div className="space-y-6">
            {/* Book Size */}
            <div className="bg-cb-card border border-cb-border rounded-card p-4">
              <h3 className="font-medium mb-3">Book Size</h3>
              <div className="grid grid-cols-3 gap-3">
                {PRODUCT_OPTIONS.sizes.map((size) => (
                  <button
                    key={size.id}
                    onClick={() => setProductOptions({ ...productOptions, size: size.id as ProductOptions['size'] })}
                    className={`p-3 rounded-input border text-left transition-all ${
                      productOptions.size === size.id
                        ? 'border-cb-primary bg-cb-primary/5'
                        : 'border-cb-border hover:border-cb-primary/50'
                    }`}
                  >
                    <p className="font-semibold text-sm">{size.label}</p>
                    <p className="text-xs text-cb-secondary mt-0.5">{size.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Binding Type */}
            <div className="bg-cb-card border border-cb-border rounded-card p-4">
              <h3 className="font-medium mb-3">Binding</h3>
              <div className="grid grid-cols-2 gap-3">
                {PRODUCT_OPTIONS.bindings.map((binding) => (
                  <button
                    key={binding.id}
                    onClick={() => setProductOptions({ ...productOptions, binding: binding.id as ProductOptions['binding'] })}
                    className={`p-3 rounded-input border text-left transition-all ${
                      productOptions.binding === binding.id
                        ? 'border-cb-primary bg-cb-primary/5'
                        : 'border-cb-border hover:border-cb-primary/50'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-sm">{binding.label}</p>
                        <p className="text-xs text-cb-secondary mt-0.5">{binding.description}</p>
                      </div>
                      {binding.priceMultiplier > 1 && (
                        <span className="text-xs text-cb-primary font-medium">+{Math.round((binding.priceMultiplier - 1) * 100)}%</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Paper Type */}
            <div className="bg-cb-card border border-cb-border rounded-card p-4">
              <h3 className="font-medium mb-3">Paper Quality</h3>
              <div className="grid grid-cols-2 gap-3">
                {PRODUCT_OPTIONS.paperTypes.map((paper) => (
                  <button
                    key={paper.id}
                    onClick={() => setProductOptions({ ...productOptions, paperType: paper.id as ProductOptions['paperType'] })}
                    className={`p-3 rounded-input border text-left transition-all ${
                      productOptions.paperType === paper.id
                        ? 'border-cb-primary bg-cb-primary/5'
                        : 'border-cb-border hover:border-cb-primary/50'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-sm">{paper.label}</p>
                        <p className="text-xs text-cb-secondary mt-0.5">{paper.description}</p>
                      </div>
                      {paper.priceMultiplier > 1 && (
                        <span className="text-xs text-cb-primary font-medium">+{Math.round((paper.priceMultiplier - 1) * 100)}%</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Cover Finish */}
            <div className="bg-cb-card border border-cb-border rounded-card p-4">
              <h3 className="font-medium mb-3">Cover Finish</h3>
              <div className="grid grid-cols-2 gap-3">
                {PRODUCT_OPTIONS.coverFinishes.map((finish) => (
                  <button
                    key={finish.id}
                    onClick={() => setProductOptions({ ...productOptions, coverFinish: finish.id as ProductOptions['coverFinish'] })}
                    className={`p-3 rounded-input border text-left transition-all ${
                      productOptions.coverFinish === finish.id
                        ? 'border-cb-primary bg-cb-primary/5'
                        : 'border-cb-border hover:border-cb-primary/50'
                    }`}
                  >
                    <p className="font-semibold text-sm">{finish.label}</p>
                    <p className="text-xs text-cb-secondary mt-0.5">{finish.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Interior Color */}
            <div className="bg-cb-card border border-cb-border rounded-card p-4">
              <h3 className="font-medium mb-3">Interior Printing</h3>
              <div className="grid grid-cols-2 gap-3">
                {PRODUCT_OPTIONS.interiorColors.map((color) => (
                  <button
                    key={color.id}
                    onClick={() => setProductOptions({ ...productOptions, interiorColor: color.id as ProductOptions['interiorColor'] })}
                    className={`p-3 rounded-input border text-left transition-all ${
                      productOptions.interiorColor === color.id
                        ? 'border-cb-primary bg-cb-primary/5'
                        : 'border-cb-border hover:border-cb-primary/50'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-sm">{color.label}</p>
                        <p className="text-xs text-cb-secondary mt-0.5">{color.description}</p>
                      </div>
                      {color.priceMultiplier < 1 && (
                        <span className="text-xs text-cb-green font-medium">-{Math.round((1 - color.priceMultiplier) * 100)}%</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Estimated price summary */}
          <div className="mt-6 p-4 bg-cb-bg rounded-card border border-cb-border">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-cb-secondary">Estimated base price</p>
                <p className="text-xs text-cb-muted mt-0.5">Final price calculated with shipping</p>
              </div>
              <div className="text-right">
                <p className="font-semibold">
                  ~${(15 + (productOptions.binding === 'hardcover' ? 8 : 0) + (productOptions.paperType === 'premium' ? 3 : 0) + selectedIds.length * 0.15).toFixed(2)}
                </p>
                <p className="text-xs text-cb-secondary">+ shipping</p>
              </div>
            </div>
          </div>

          {generateError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-input text-red-700 text-sm">
              {generateError}
            </div>
          )}

          <div className="flex items-center justify-between mt-6">
            <button
              onClick={() => setStep('details')}
              className="text-cb-secondary hover:text-cb-text transition-colors"
            >
              ← Back
            </button>
            <button
              onClick={handleCreateCookbook}
              disabled={generating}
              className="bg-cb-primary text-white px-6 py-2.5 rounded-input font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-2"
            >
              {generating ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Generating Preview...
                </>
              ) : (
                <>
                  Generate Preview
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                  </svg>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Preview */}
      {step === 'preview' && cookbook && (
        <div className="max-w-2xl">
          <h2 className="text-lg font-semibold mb-4">Preview Your Cookbook</h2>

          <div className="bg-cb-card border border-cb-border rounded-card p-6 mb-6">
            <div className="flex gap-6">
              {/* Cover preview */}
              <div
                className={`w-40 h-52 rounded-lg flex items-center justify-center text-center p-4 ${
                  cookbook.cover_style === 'classic'
                    ? 'bg-[#faf7f0]'
                    : cookbook.cover_style === 'modern'
                    ? 'bg-[#1a1a1a] text-white'
                    : 'bg-white border border-cb-border'
                }`}
              >
                <div>
                  <p className={`font-bold text-lg mb-1 ${cookbook.cover_style === 'modern' ? 'text-white' : ''}`}>
                    {cookbook.title}
                  </p>
                  {cookbook.subtitle && (
                    <p className={`text-xs ${cookbook.cover_style === 'modern' ? 'text-gray-400' : 'text-cb-secondary'}`}>
                      {cookbook.subtitle}
                    </p>
                  )}
                  <p className={`text-xs mt-3 ${cookbook.cover_style === 'modern' ? 'text-gray-500' : 'text-cb-muted'}`}>
                    by {cookbook.author_name}
                  </p>
                </div>
              </div>

              {/* Details */}
              <div className="flex-1">
                <h3 className="font-semibold text-lg">{cookbook.title}</h3>
                {cookbook.subtitle && (
                  <p className="text-cb-secondary">{cookbook.subtitle}</p>
                )}
                <p className="text-sm text-cb-muted mt-1">by {cookbook.author_name}</p>

                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-cb-secondary">Recipes:</span>
                    <span className="font-medium">{cookbook.recipe_ids.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-cb-secondary">Pages:</span>
                    <span className="font-medium">~{cookbook.page_count || 'calculating...'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-cb-secondary">Format:</span>
                    <span className="font-medium">8.5" × 11" Softcover</span>
                  </div>
                </div>

                {cookbook.interior_pdf_url && (
                  <a
                    href={`/api/pdf?url=${encodeURIComponent(cookbook.interior_pdf_url)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 mt-4 bg-cb-green text-white px-4 py-2 rounded-input font-semibold hover:opacity-90 transition-opacity text-sm"
                  >
                    Preview PDF
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                    </svg>
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={() => setStep('options')}
              className="text-cb-secondary hover:text-cb-text transition-colors"
            >
              ← Back
            </button>
            <button
              onClick={() => setStep('order')}
              className="bg-cb-primary text-white px-6 py-2.5 rounded-input font-semibold hover:opacity-90 transition-opacity flex items-center gap-2"
            >
              Order Now
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Step 5: Order */}
      {step === 'order' && cookbook && (
        <div className="max-w-xl">
          <h2 className="text-lg font-semibold mb-4">Complete Your Order</h2>

          <div className="space-y-4 mb-6">
            {/* Quantity */}
            <div>
              <label className="block text-sm font-medium mb-1">Quantity</label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-10 h-10 rounded-input border border-cb-border flex items-center justify-center hover:border-cb-primary transition-colors"
                >
                  −
                </button>
                <span className="w-12 text-center font-semibold">{quantity}</span>
                <button
                  onClick={() => setQuantity(Math.min(10, quantity + 1))}
                  className="w-10 h-10 rounded-input border border-cb-border flex items-center justify-center hover:border-cb-primary transition-colors"
                >
                  +
                </button>
              </div>
            </div>

            {/* Shipping Address */}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">Full Name *</label>
                <input
                  type="text"
                  value={shippingAddress.name}
                  onChange={(e) => setShippingAddress({ ...shippingAddress, name: e.target.value })}
                  className="w-full bg-cb-bg border border-cb-border rounded-input px-4 py-2.5 text-sm outline-none focus:border-cb-primary transition-colors"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">Street Address *</label>
                <input
                  type="text"
                  value={shippingAddress.street1}
                  onChange={(e) => setShippingAddress({ ...shippingAddress, street1: e.target.value })}
                  className="w-full bg-cb-bg border border-cb-border rounded-input px-4 py-2.5 text-sm outline-none focus:border-cb-primary transition-colors"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">Apt, Suite, etc.</label>
                <input
                  type="text"
                  value={shippingAddress.street2}
                  onChange={(e) => setShippingAddress({ ...shippingAddress, street2: e.target.value })}
                  className="w-full bg-cb-bg border border-cb-border rounded-input px-4 py-2.5 text-sm outline-none focus:border-cb-primary transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">City *</label>
                <input
                  type="text"
                  value={shippingAddress.city}
                  onChange={(e) => setShippingAddress({ ...shippingAddress, city: e.target.value })}
                  className="w-full bg-cb-bg border border-cb-border rounded-input px-4 py-2.5 text-sm outline-none focus:border-cb-primary transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">State</label>
                <input
                  type="text"
                  value={shippingAddress.state}
                  onChange={(e) => setShippingAddress({ ...shippingAddress, state: e.target.value })}
                  className="w-full bg-cb-bg border border-cb-border rounded-input px-4 py-2.5 text-sm outline-none focus:border-cb-primary transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">ZIP/Postal Code *</label>
                <input
                  type="text"
                  value={shippingAddress.postcode}
                  onChange={(e) => setShippingAddress({ ...shippingAddress, postcode: e.target.value })}
                  className="w-full bg-cb-bg border border-cb-border rounded-input px-4 py-2.5 text-sm outline-none focus:border-cb-primary transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Country *</label>
                <select
                  value={shippingAddress.country_code}
                  onChange={(e) => setShippingAddress({ ...shippingAddress, country_code: e.target.value })}
                  className="w-full bg-cb-bg border border-cb-border rounded-input px-4 py-2.5 text-sm outline-none focus:border-cb-primary transition-colors"
                >
                  <option value="US">United States</option>
                  <option value="CA">Canada</option>
                  <option value="GB">United Kingdom</option>
                  <option value="AU">Australia</option>
                  <option value="DE">Germany</option>
                  <option value="FR">France</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">Phone *</label>
                <input
                  type="tel"
                  value={shippingAddress.phone}
                  onChange={(e) => setShippingAddress({ ...shippingAddress, phone: e.target.value })}
                  placeholder="+1 555 123 4567"
                  className="w-full bg-cb-bg border border-cb-border rounded-input px-4 py-2.5 text-sm outline-none focus:border-cb-primary transition-colors"
                />
              </div>
            </div>

            {/* Shipping Speed */}
            <div>
              <label className="block text-sm font-medium mb-2">Shipping Speed</label>
              <div className="space-y-2">
                {[
                  { value: 'GROUND', label: 'Ground', est: '7-14 days' },
                  { value: 'EXPEDITED', label: 'Expedited', est: '3-5 days' },
                  { value: 'EXPRESS', label: 'Express', est: '1-3 days' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setShippingLevel(opt.value)}
                    className={`w-full flex items-center justify-between p-3 rounded-input border transition-all ${
                      shippingLevel === opt.value
                        ? 'border-cb-primary bg-cb-primary/5'
                        : 'border-cb-border hover:border-cb-primary/50'
                    }`}
                  >
                    <span className="font-medium">{opt.label}</span>
                    <span className="text-sm text-cb-secondary">{opt.est}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Get Price Button */}
            <button
              onClick={handleGetPricing}
              disabled={!shippingAddress.name || !shippingAddress.street1 || !shippingAddress.city || !shippingAddress.postcode || !shippingAddress.phone}
              className="w-full bg-cb-bg border border-cb-border text-cb-text py-3 rounded-input font-medium hover:border-cb-primary transition-colors disabled:opacity-50"
            >
              Calculate Price
            </button>

            {/* Pricing */}
            {pricing && (
              <div className="bg-cb-bg rounded-card p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Print & Production</span>
                  <span>${(pricing.lulu_cost_cents / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Shipping</span>
                  <span>${(pricing.shipping_cost_cents / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>ChefsBook Service Fee</span>
                  <span>${(pricing.our_margin_cents / 100).toFixed(2)}</span>
                </div>
                <div className="border-t border-cb-border pt-2 mt-2 flex justify-between font-semibold">
                  <span>Total</span>
                  <span>${(pricing.total_cents / 100).toFixed(2)}</span>
                </div>
                {pricing.mock && (
                  <p className="text-xs text-cb-muted mt-2">* Estimated pricing (sandbox mode)</p>
                )}
              </div>
            )}
          </div>

          {orderError && (
            <div className="bg-red-50 border border-red-200 text-cb-primary rounded-input p-3 mb-4 text-sm">
              {orderError}
            </div>
          )}

          <div className="flex items-center justify-between">
            <button
              onClick={() => setStep('preview')}
              className="text-cb-secondary hover:text-cb-text transition-colors"
            >
              ← Back
            </button>
            <button
              onClick={handlePlaceOrder}
              disabled={!pricing || ordering}
              className="bg-cb-primary text-white px-6 py-2.5 rounded-input font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-2"
            >
              {ordering ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Processing...
                </>
              ) : (
                <>
                  Place Order
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                  </svg>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Step 6: Confirmation */}
      {step === 'confirm' && (
        <div className="max-w-lg mx-auto text-center py-12">
          <div className="w-20 h-20 rounded-full bg-cb-green/10 flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-cb-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold mb-3">Order Confirmed!</h2>
          <p className="text-cb-secondary mb-6">
            Your cookbook is being printed. You'll receive an email when it ships.
          </p>
          <div className="flex justify-center gap-4">
            <Link
              href="/dashboard/orders"
              className="bg-cb-primary text-white px-6 py-2.5 rounded-input font-semibold hover:opacity-90 transition-opacity"
            >
              View My Orders
            </Link>
            <Link
              href="/dashboard"
              className="text-cb-secondary hover:text-cb-text transition-colors py-2.5"
            >
              Back to Recipes
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
