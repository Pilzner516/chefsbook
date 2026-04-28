'use client';

import { useEffect, useState, useReducer, useCallback, use, useMemo, Component, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase, PLAN_LIMITS, getPrimaryPhotos, listRecipePhotos } from '@chefsbook/db';
import type { PlanTier } from '@chefsbook/db';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';
import { proxyIfNeeded } from '@/lib/recipeImage';
import {
  checkImageQuality,
  type QualityResult,
  type QualityTier,
  type PrintUsage,
} from '@/lib/print-quality';
import {
  BookLayout,
  BookCard,
  RecipeCard,
  CoverCard,
  ForewordCard,
  TocCard,
  IndexCard,
  BackCard,
  RecipePage,
  computePageMap,
  createRecipeCard,
  insertRecipeCard,
  removeRecipeCard,
  getRecipeCards,
  moveCard,
  getTotalPageCount,
} from '@/lib/book-layout';
import { useDebouncedCallback } from 'use-debounce';
import FlipbookPreview from '@/components/print/FlipbookPreview';

// Error boundary to catch rendering errors
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Canvas editor error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-cb-bg flex items-center justify-center p-8">
          <div className="bg-white rounded-card p-6 max-w-lg shadow-lg">
            <h2 className="text-xl font-bold text-red-600 mb-4">Something went wrong</h2>
            <pre className="text-xs bg-gray-100 p-3 rounded overflow-auto max-h-48 mb-4">
              {this.state.error?.message}
              {'\n\n'}
              {this.state.error?.stack}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="bg-cb-primary text-white px-4 py-2 rounded-input"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

interface RecipePreview {
  id: string;
  title: string;
  cuisine: string | null;
  total_minutes: number | null;
  servings: number | null;
  image_url: string | null;
  step_count?: number;
}

type LayoutAction =
  | { type: 'SET_LAYOUT'; payload: BookLayout }
  | { type: 'MOVE_CARD'; sourceIndex: number; destIndex: number }
  | { type: 'UPDATE_COVER'; payload: Partial<CoverCard> }
  | { type: 'UPDATE_FOREWORD'; text: string }
  | { type: 'ADD_RECIPE'; recipe: RecipePreview; imageUrls: string[] }
  | { type: 'REMOVE_RECIPE'; cardId: string }
  | { type: 'UPDATE_RECIPE_DISPLAY_NAME'; cardId: string; displayName: string }
  | { type: 'UPDATE_RECIPE_IMAGE'; cardId: string; pageId: string; imageUrl: string | undefined }
  | { type: 'ADD_CUSTOM_PAGE'; cardId: string; layout: 'image_only' | 'text_only' | 'image_and_text' }
  | { type: 'UPDATE_CUSTOM_PAGE'; cardId: string; pageId: string; updates: { image_url?: string; text?: string; caption?: string } }
  | { type: 'REMOVE_PAGE'; cardId: string; pageId: string }
  | { type: 'MOVE_PAGE'; cardId: string; sourceIndex: number; destIndex: number };

function layoutReducer(state: BookLayout, action: LayoutAction): BookLayout {
  switch (action.type) {
    case 'SET_LAYOUT':
      return action.payload;

    case 'MOVE_CARD':
      return moveCard(state, action.sourceIndex, action.destIndex);

    case 'UPDATE_COVER': {
      const cards = state.cards.map((card) => {
        if (card.type === 'cover') {
          return { ...card, ...action.payload };
        }
        return card;
      });
      return { ...state, cards };
    }

    case 'UPDATE_FOREWORD': {
      const cards = state.cards.map((card) => {
        if (card.type === 'foreword') {
          return { ...card, text: action.text };
        }
        return card;
      });
      return { ...state, cards };
    }

    case 'ADD_RECIPE': {
      const recipeCard = createRecipeCard({
        id: action.recipe.id,
        title: action.recipe.title,
        image_urls: action.imageUrls,
        step_count: action.recipe.step_count || 0,
      });
      return insertRecipeCard(state, recipeCard);
    }

    case 'REMOVE_RECIPE':
      return removeRecipeCard(state, action.cardId);

    case 'UPDATE_RECIPE_DISPLAY_NAME': {
      const cards = state.cards.map((card) => {
        if (card.type === 'recipe' && card.id === action.cardId) {
          return { ...card, display_name: action.displayName };
        }
        return card;
      });
      return { ...state, cards };
    }

    case 'UPDATE_RECIPE_IMAGE': {
      const cards = state.cards.map((card) => {
        if (card.type === 'recipe' && card.id === action.cardId) {
          const pages = card.pages.map((page) => {
            if (page.id === action.pageId && page.kind === 'image') {
              return { ...page, image_url: action.imageUrl };
            }
            return page;
          });
          return { ...card, pages };
        }
        return card;
      });
      return { ...state, cards };
    }

    case 'ADD_CUSTOM_PAGE': {
      const cards = state.cards.map((card) => {
        if (card.type === 'recipe' && card.id === action.cardId) {
          const newPage: RecipePage = {
            id: crypto.randomUUID(),
            kind: 'custom',
            layout: action.layout,
          };
          return { ...card, pages: [...card.pages, newPage] };
        }
        return card;
      });
      return { ...state, cards };
    }

    case 'UPDATE_CUSTOM_PAGE': {
      const cards = state.cards.map((card) => {
        if (card.type === 'recipe' && card.id === action.cardId) {
          const pages = card.pages.map((page) => {
            if (page.id === action.pageId && page.kind === 'custom') {
              return { ...page, ...action.updates };
            }
            return page;
          });
          return { ...card, pages };
        }
        return card;
      });
      return { ...state, cards };
    }

    case 'REMOVE_PAGE': {
      const cards = state.cards.map((card) => {
        if (card.type === 'recipe' && card.id === action.cardId) {
          const pages = card.pages.filter((p) => p.id !== action.pageId);
          return { ...card, pages };
        }
        return card;
      });
      return { ...state, cards };
    }

    case 'MOVE_PAGE': {
      const cards = state.cards.map((card) => {
        if (card.type === 'recipe' && card.id === action.cardId) {
          const pages = [...card.pages];
          const [moved] = pages.splice(action.sourceIndex, 1);
          pages.splice(action.destIndex, 0, moved);
          return { ...card, pages };
        }
        return card;
      });
      return { ...state, cards };
    }

    default:
      return state;
  }
}

const emptyLayout: BookLayout = { version: 1, language: 'en', cards: [] };

export default function PrintCookbookCanvasPage(props: { params: Promise<{ id: string }> }) {
  return (
    <ErrorBoundary>
      <PrintCookbookCanvasPageInner {...props} />
    </ErrorBoundary>
  );
}

function PrintCookbookCanvasPageInner({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: cookbookId } = use(params);
  const router = useRouter();
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [session, setSession] = useState<{ access_token: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [layout, dispatch] = useReducer(layoutReducer, emptyLayout);
  const [pageMap, setPageMap] = useState<Record<string, number>>({});

  // Recipe picker state
  const [showRecipePicker, setShowRecipePicker] = useState(false);
  const [recipes, setRecipes] = useState<RecipePreview[]>([]);
  const [primaryPhotos, setPrimaryPhotos] = useState<Record<string, string>>({});
  const [recipesLoading, setRecipesLoading] = useState(false);

  // Book settings panel state
  const [showSettings, setShowSettings] = useState(false);

  // Expanded recipe cards
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  // Image quality results cache: url -> QualityResult
  const [imageQualities, setImageQualities] = useState<Record<string, QualityResult>>({});

  // PDF generation state
  const [generating, setGenerating] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);

  // Flipbook preview state
  const [showFlipbook, setShowFlipbook] = useState(false);

  // Quality warning state (must be before any early return)
  const [showQualityWarning, setShowQualityWarning] = useState(false);

  // Compute quality issues for pre-generate check (must be before any early return)
  const qualityIssues = useMemo(() => {
    const issues: { name: string; tier: QualityTier }[] = [];

    // Check cover image
    const coverCard = layout.cards.find((c) => c.type === 'cover') as CoverCard | undefined;
    if (coverCard?.image_url && imageQualities[coverCard.image_url]) {
      const q = imageQualities[coverCard.image_url];
      if (q.tier !== 'excellent') {
        issues.push({ name: 'Cover image', tier: q.tier });
      }
    }

    // Check recipe images
    for (const card of getRecipeCards(layout)) {
      const imagePage = card.pages.find((p) => p.kind === 'image');
      if (imagePage?.kind === 'image' && imagePage.image_url && imageQualities[imagePage.image_url]) {
        const q = imageQualities[imagePage.image_url];
        if (q.tier !== 'excellent') {
          issues.push({ name: card.display_name, tier: q.tier });
        }
      }
    }

    return issues;
  }, [layout, imageQualities]);

  const hasPoorQuality = qualityIssues.some((i) => i.tier === 'poor');
  const hasAcceptableQuality = qualityIssues.some((i) => i.tier === 'acceptable');

  // Update page map when layout changes
  useEffect(() => {
    if (layout.cards.length > 0) {
      setPageMap(computePageMap(layout));
    }
  }, [layout]);

  // Check image quality and cache result
  const checkQuality = useCallback(async (url: string, usage: PrintUsage = 'full_bleed') => {
    if (!url || imageQualities[url]) return;
    try {
      const result = await checkImageQuality(proxyIfNeeded(url), usage);
      setImageQualities((prev) => ({ ...prev, [url]: result }));
    } catch (err) {
      console.warn('Quality check failed for', url, err);
    }
  }, [imageQualities]);

  // Auto-save with debounce
  const debouncedSave = useDebouncedCallback(async (layoutToSave: BookLayout) => {
    if (!session) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/print-cookbook/${cookbookId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ book_layout: layoutToSave }),
      });
      if (res.ok) {
        setLastSaved(new Date());
      }
    } catch (error) {
      console.error('Auto-save failed:', error);
    } finally {
      setSaving(false);
    }
  }, 800);

  // Trigger auto-save on layout changes (but not on initial load)
  useEffect(() => {
    if (layout.cards.length > 0 && !loading) {
      debouncedSave(layout);
    }
  }, [layout, loading]);

  useEffect(() => {
    checkAuthAndLoad();
  }, [cookbookId]);

  const checkAuthAndLoad = async () => {
    const { data: { session: sess } } = await supabase.auth.getSession();
    if (!sess?.user) {
      router.push('/auth');
      return;
    }
    setUser(sess.user);
    setSession(sess);

    // Load the cookbook
    const res = await fetch(`/api/print-cookbook/${cookbookId}`, {
      headers: {
        'Authorization': `Bearer ${sess.access_token}`,
      },
    });

    if (!res.ok) {
      router.push('/dashboard/print-cookbook');
      return;
    }

    const { cookbook } = await res.json();
    console.log('[Canvas] Loaded cookbook:', cookbook);
    console.log('[Canvas] book_layout:', JSON.stringify(cookbook.book_layout, null, 2));

    if (cookbook.book_layout) {
      // Validate the layout structure before dispatching
      const layout = cookbook.book_layout;
      if (layout && Array.isArray(layout.cards)) {
        // Ensure all recipe cards have valid pages arrays
        const validatedLayout = {
          ...layout,
          cards: layout.cards.map((card: BookCard) => {
            if (card.type === 'recipe') {
              const recipeCard = card as RecipeCard;
              return {
                ...recipeCard,
                pages: Array.isArray(recipeCard.pages) ? recipeCard.pages.filter((p: RecipePage) => p && p.kind) : [],
              };
            }
            return card;
          }),
        };
        console.log('[Canvas] Validated layout:', validatedLayout);
        dispatch({ type: 'SET_LAYOUT', payload: validatedLayout });
      } else {
        console.error('[Canvas] Invalid layout structure:', layout);
      }
    }

    setLoading(false);
  };

  const loadRecipes = async () => {
    if (!user) return;
    setRecipesLoading(true);

    const { data, count } = await supabase
      .from('recipes')
      .select('id, title, cuisine, total_minutes, servings, image_url', { count: 'exact' })
      .eq('user_id', user.id)
      .order('title');

    const recipeList = data || [];

    // Get step counts
    const recipeWithSteps = await Promise.all(
      recipeList.map(async (r) => {
        const { count } = await supabase
          .from('recipe_steps')
          .select('*', { count: 'exact', head: true })
          .eq('recipe_id', r.id);
        return { ...r, step_count: count || 0 };
      })
    );

    setRecipes(recipeWithSteps);

    if (recipeList.length > 0) {
      const photos = await getPrimaryPhotos(recipeList.map((r) => r.id));
      setPrimaryPhotos(photos);
    }

    setRecipesLoading(false);
  };

  const handleAddRecipe = async (recipe: RecipePreview) => {
    // Check if already added
    const existingIds = getRecipeCards(layout).map((c) => c.recipe_id);
    if (existingIds.includes(recipe.id)) return;

    // Get image URLs for this recipe
    const photos = await listRecipePhotos(recipe.id);
    const imageUrls = photos.map((p) => p.url);

    dispatch({ type: 'ADD_RECIPE', recipe, imageUrls });
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const { source, destination, type } = result;

    if (type === 'CARD') {
      dispatch({
        type: 'MOVE_CARD',
        sourceIndex: source.index,
        destIndex: destination.index,
      });
    } else if (type === 'PAGE') {
      // Page drag within a recipe card
      const cardId = source.droppableId.replace('pages-', '');
      dispatch({
        type: 'MOVE_PAGE',
        cardId,
        sourceIndex: source.index,
        destIndex: destination.index,
      });
    }
  };

  const toggleCardExpanded = (cardId: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else {
        next.add(cardId);
      }
      return next;
    });
  };

  const handleGeneratePdf = async () => {
    if (!session || generating) return;
    setGenerating(true);
    setGeneratedUrl(null);

    try {
      const res = await fetch(`/api/print-cookbooks/${cookbookId}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'PDF generation failed');
      }

      const data = await res.json();
      if (data.cookbook?.interior_pdf_url) {
        setGeneratedUrl(data.cookbook.interior_pdf_url);
      }
    } catch (error) {
      console.error('PDF generation failed:', error);
      alert(error instanceof Error ? error.message : 'PDF generation failed');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center text-cb-secondary py-20">Loading...</div>
      </div>
    );
  }

  const totalPages = getTotalPageCount(layout);
  const recipeCount = getRecipeCards(layout).length;

  return (
    <div className="min-h-screen bg-cb-bg">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-cb-card border-b border-cb-border px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/print-cookbook" className="text-cb-secondary hover:text-cb-text">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
              </svg>
            </Link>
            <div>
              <h1 className="font-bold">Print My ChefsBook</h1>
              <p className="text-xs text-cb-secondary">
                {recipeCount} recipes · {totalPages} pages ·{' '}
                {saving ? 'Saving...' : lastSaved ? `Saved ${lastSaved.toLocaleTimeString()}` : 'Not saved'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                loadRecipes();
                setShowRecipePicker(true);
              }}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-cb-text bg-cb-bg border border-cb-border rounded-input hover:border-cb-primary/50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add Recipes
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-cb-text bg-cb-bg border border-cb-border rounded-input hover:border-cb-primary/50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
              </svg>
              Book Settings
            </button>
            <button
              onClick={() => setShowFlipbook(true)}
              disabled={recipeCount < 1}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-cb-text bg-cb-bg border border-cb-border rounded-input hover:border-cb-primary/50 disabled:opacity-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
              </svg>
              Preview Book
            </button>
            {/* Quality warning indicator */}
            {qualityIssues.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowQualityWarning(!showQualityWarning)}
                  className={`flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-input border transition-colors ${
                    hasPoorQuality
                      ? 'bg-red-50 border-red-200 text-red-700'
                      : 'bg-amber-50 border-amber-200 text-amber-700'
                  }`}
                >
                  {hasPoorQuality ? '🔴' : '🟡'} {qualityIssues.length} photo{qualityIssues.length !== 1 ? 's' : ''}
                </button>
                {showQualityWarning && (
                  <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-cb-border rounded-card shadow-lg p-3 z-30">
                    <p className="text-sm font-medium text-cb-text mb-2">
                      {hasPoorQuality ? 'Low resolution photos detected' : 'Photos may print soft'}
                    </p>
                    <ul className="space-y-1 text-xs text-cb-secondary max-h-32 overflow-y-auto">
                      {qualityIssues.map((issue, i) => (
                        <li key={i} className="flex items-center gap-1">
                          {issue.tier === 'poor' ? '🔴' : '🟡'} {issue.name}
                        </li>
                      ))}
                    </ul>
                    {hasPoorQuality && (
                      <p className="text-xs text-red-600 mt-2">
                        Fix low-resolution photos before generating.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
            <button
              onClick={hasPoorQuality ? undefined : (hasAcceptableQuality && !showQualityWarning ? () => setShowQualityWarning(true) : handleGeneratePdf)}
              disabled={recipeCount < 5 || generating || hasPoorQuality}
              className={`flex items-center gap-2 px-5 py-2 rounded-input font-semibold transition-opacity ${
                hasPoorQuality
                  ? 'bg-gray-400 text-white cursor-not-allowed'
                  : 'bg-cb-primary text-white hover:opacity-90 disabled:opacity-50'
              }`}
            >
              {generating ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Generating...
                </>
              ) : hasPoorQuality ? (
                'Fix photos first'
              ) : (
                'Generate PDF →'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Generated PDF Modal */}
      {generatedUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setGeneratedUrl(null)} />
          <div className="relative bg-cb-card rounded-card p-6 max-w-md w-full mx-4 shadow-xl">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-cb-green/10 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-cb-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold mb-2">PDF Generated!</h2>
              <p className="text-cb-secondary text-sm mb-6">
                Your cookbook PDF is ready for preview and printing.
              </p>
              <div className="flex gap-3 justify-center">
                <a
                  href={`/api/pdf?url=${encodeURIComponent(generatedUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-cb-primary text-white px-5 py-2.5 rounded-input font-semibold hover:opacity-90 transition-opacity"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  </svg>
                  Preview PDF
                </a>
                <button
                  onClick={() => setGeneratedUrl(null)}
                  className="px-5 py-2.5 text-cb-secondary font-medium hover:text-cb-text transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Canvas */}
      <div className="p-6">
        <p className="text-sm text-cb-secondary mb-4 text-center">
          Drag cards to reorder. Click to edit.
        </p>

        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="cards" type="CARD">
            {(provided) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-5xl mx-auto"
              >
                {layout.cards.map((card, index) => (
                  <Draggable
                    key={card.id}
                    draggableId={card.id}
                    index={index}
                    isDragDisabled={card.locked}
                  >
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`bg-cb-card border rounded-card overflow-hidden transition-all ${
                          snapshot.isDragging ? 'shadow-lg border-cb-primary' : 'border-cb-border'
                        } ${card.locked ? 'opacity-90' : ''}`}
                      >
                        {/* Card Header */}
                        <div className="flex items-center gap-2 px-4 py-3 bg-cb-bg border-b border-cb-border">
                          {card.locked ? (
                            <div className="text-cb-muted" title="Locked">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                              </svg>
                            </div>
                          ) : (
                            <div
                              {...provided.dragHandleProps}
                              className="text-cb-muted cursor-grab hover:text-cb-text"
                              title="Drag to reorder"
                            >
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                <circle cx="9" cy="6" r="1.5" />
                                <circle cx="15" cy="6" r="1.5" />
                                <circle cx="9" cy="12" r="1.5" />
                                <circle cx="15" cy="12" r="1.5" />
                                <circle cx="9" cy="18" r="1.5" />
                                <circle cx="15" cy="18" r="1.5" />
                              </svg>
                            </div>
                          )}
                          <span className="text-xs font-semibold uppercase tracking-wide text-cb-muted">
                            {card.type}
                          </span>
                          <span className="flex-1" />
                          <span className="text-xs text-cb-muted">
                            Page {pageMap[card.id]}
                          </span>
                          {card.type === 'recipe' && (
                            <button
                              onClick={() => dispatch({ type: 'REMOVE_RECIPE', cardId: card.id })}
                              className="text-cb-muted hover:text-cb-primary p-1"
                              title="Remove"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </div>

                        {/* Card Body */}
                        <div className="p-4">
                          {renderCardBody(card, {
                            dispatch,
                            isExpanded: expandedCards.has(card.id),
                            onToggleExpand: () => toggleCardExpanded(card.id),
                            primaryPhotos,
                            imageQualities,
                            checkQuality,
                            session,
                            cookbookId,
                          })}
                        </div>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>

        {recipeCount < 5 && (
          <div className="text-center mt-8 p-4 bg-amber-50 border border-amber-200 rounded-card max-w-lg mx-auto">
            <p className="text-sm text-amber-800">
              Add at least {5 - recipeCount} more recipe{5 - recipeCount !== 1 ? 's' : ''} to generate your cookbook.
            </p>
          </div>
        )}
      </div>

      {/* Recipe Picker Panel */}
      {showRecipePicker && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/20" onClick={() => setShowRecipePicker(false)} />
          <div className="relative w-full max-w-lg bg-cb-card border-l border-cb-border h-full overflow-y-auto">
            <div className="sticky top-0 bg-cb-card border-b border-cb-border p-4 flex items-center justify-between">
              <h2 className="font-semibold">Add Recipes</h2>
              <button onClick={() => setShowRecipePicker(false)} className="text-cb-muted hover:text-cb-text">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4">
              {recipesLoading ? (
                <div className="text-center text-cb-secondary py-8">Loading recipes...</div>
              ) : (
                <div className="space-y-2">
                  {recipes.map((recipe) => {
                    const isAdded = getRecipeCards(layout).some((c) => c.recipe_id === recipe.id);
                    return (
                      <button
                        key={recipe.id}
                        onClick={() => handleAddRecipe(recipe)}
                        disabled={isAdded}
                        className={`w-full flex items-center gap-3 p-3 rounded-input border text-left transition-all ${
                          isAdded
                            ? 'bg-cb-bg border-cb-border opacity-60'
                            : 'bg-cb-card border-cb-border hover:border-cb-primary'
                        }`}
                      >
                        {(primaryPhotos[recipe.id] || recipe.image_url) ? (
                          <img
                            src={proxyIfNeeded(primaryPhotos[recipe.id] || recipe.image_url!)}
                            alt=""
                            className="w-12 h-12 object-cover rounded"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-cb-bg rounded flex items-center justify-center">
                            <svg className="w-6 h-6 text-cb-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                            </svg>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{recipe.title}</p>
                          <p className="text-xs text-cb-secondary">
                            {recipe.cuisine && `${recipe.cuisine} · `}
                            {recipe.total_minutes && `${recipe.total_minutes} min`}
                          </p>
                        </div>
                        {isAdded && (
                          <span className="text-xs text-cb-green font-medium">Added</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Book Settings Panel */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/20" onClick={() => setShowSettings(false)} />
          <div className="relative w-full max-w-md bg-cb-card border-l border-cb-border h-full overflow-y-auto">
            <div className="sticky top-0 bg-cb-card border-b border-cb-border p-4 flex items-center justify-between">
              <h2 className="font-semibold">Book Settings</h2>
              <button onClick={() => setShowSettings(false)} className="text-cb-muted hover:text-cb-text">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 space-y-4">
              <CoverSettingsPanel layout={layout} dispatch={dispatch} />
            </div>
          </div>
        </div>
      )}

      {/* Flipbook Preview */}
      {showFlipbook && (
        <FlipbookPreview
          layout={layout}
          onClose={() => setShowFlipbook(false)}
          imageQualities={imageQualities}
          templateStyle={(layout.cards.find((c) => c.type === 'cover') as CoverCard | undefined)?.cover_style || 'classic'}
        />
      )}
    </div>
  );
}

// Render card body based on type
function renderCardBody(
  card: BookCard,
  opts: {
    dispatch: React.Dispatch<LayoutAction>;
    isExpanded: boolean;
    onToggleExpand: () => void;
    primaryPhotos: Record<string, string>;
    imageQualities: Record<string, QualityResult>;
    checkQuality: (url: string, usage?: PrintUsage) => Promise<void>;
    session: { access_token: string } | null;
    cookbookId: string;
  }
) {
  switch (card.type) {
    case 'cover':
      return (
        <CoverCardBody
          card={card}
          dispatch={opts.dispatch}
          imageQualities={opts.imageQualities}
          checkQuality={opts.checkQuality}
        />
      );
    case 'foreword':
      return <ForewordCardBody card={card} dispatch={opts.dispatch} />;
    case 'toc':
      return <TocCardBody />;
    case 'recipe':
      return (
        <RecipeCardBody
          card={card}
          dispatch={opts.dispatch}
          isExpanded={opts.isExpanded}
          onToggleExpand={opts.onToggleExpand}
          primaryPhoto={opts.primaryPhotos[card.recipe_id]}
          imageQualities={opts.imageQualities}
          checkQuality={opts.checkQuality}
          session={opts.session}
          cookbookId={opts.cookbookId}
        />
      );
    case 'index':
      return <IndexCardBody />;
    case 'back':
      return <BackCardBody />;
    default:
      return null;
  }
}

function QualityBadge({ quality, compact = false }: { quality?: QualityResult; compact?: boolean }) {
  if (!quality) return null;

  const badges: Record<QualityTier, { icon: string; color: string; label: string; shortLabel: string }> = {
    excellent: { icon: '🟢', color: 'text-green-600', label: `${quality.dpi} DPI`, shortLabel: '' },
    acceptable: { icon: '🟡', color: 'text-amber-600', label: `${quality.dpi} DPI - may print soft`, shortLabel: '' },
    poor: { icon: '🔴', color: 'text-red-600', label: `${quality.dpi} DPI - too low`, shortLabel: '' },
  };

  const badge = badges[quality.tier];

  return (
    <div className={`flex items-center gap-1 text-xs ${badge.color}`} title={badge.label}>
      <span>{badge.icon}</span>
      {!compact && quality.tier !== 'excellent' && <span className="font-medium">{badge.label}</span>}
    </div>
  );
}

function CoverCardBody({
  card,
  dispatch,
  imageQualities,
  checkQuality,
}: {
  card: CoverCard;
  dispatch: React.Dispatch<LayoutAction>;
  imageQualities: Record<string, QualityResult>;
  checkQuality: (url: string, usage?: PrintUsage) => Promise<void>;
}) {
  // Check quality on mount/image change
  useEffect(() => {
    if (card.image_url) {
      checkQuality(card.image_url, 'cover');
    }
  }, [card.image_url, checkQuality]);

  const quality = card.image_url ? imageQualities[card.image_url] : undefined;

  return (
    <div className="text-center">
      <div className="relative">
        {card.image_url ? (
          <img
            src={proxyIfNeeded(card.image_url)}
            alt=""
            className="w-full h-32 object-cover rounded mb-3"
          />
        ) : (
          <div className="w-full h-32 bg-[#faf7f0] rounded mb-3 flex items-center justify-center border-2 border-dashed border-cb-border">
            <span className="text-sm text-cb-muted">No cover image</span>
          </div>
        )}
        {quality && (
          <div className="absolute top-2 left-2 bg-white/90 rounded px-1.5 py-0.5">
            <QualityBadge quality={quality} />
          </div>
        )}
      </div>
      <p className="font-bold text-lg truncate">{card.title || 'Untitled'}</p>
      {card.subtitle && <p className="text-sm text-cb-secondary truncate">{card.subtitle}</p>}
      <p className="text-xs text-cb-muted mt-1">by {card.author || 'Author'}</p>
    </div>
  );
}

function ForewordCardBody({ card, dispatch }: { card: ForewordCard; dispatch: React.Dispatch<LayoutAction> }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(card.text || '');

  const handleSave = () => {
    dispatch({ type: 'UPDATE_FOREWORD', text });
    setEditing(false);
  };

  if (editing) {
    return (
      <div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 1000))}
          placeholder="Write a foreword or dedication..."
          rows={4}
          className="w-full bg-cb-bg border border-cb-border rounded-input px-3 py-2 text-sm resize-none focus:outline-none focus:border-cb-primary"
          autoFocus
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-cb-muted">{text.length}/1000</span>
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)} className="text-sm text-cb-secondary hover:text-cb-text">
              Cancel
            </button>
            <button onClick={handleSave} className="text-sm text-cb-primary font-medium">
              Save
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {card.text ? (
        <p className="text-sm text-cb-secondary italic line-clamp-3">"{card.text}"</p>
      ) : (
        <p className="text-sm text-cb-muted">Click to add a foreword</p>
      )}
      <button
        onClick={() => setEditing(true)}
        className="mt-2 text-xs text-cb-primary hover:underline"
      >
        Edit
      </button>
    </div>
  );
}

function TocCardBody() {
  return (
    <div className="text-sm text-cb-secondary">
      <p className="font-semibold text-cb-text mb-2">Table of Contents</p>
      <p className="text-xs text-cb-muted italic">
        (Auto-generated from recipe order)
      </p>
    </div>
  );
}

function RecipeCardBody({
  card,
  dispatch,
  isExpanded,
  onToggleExpand,
  primaryPhoto,
  imageQualities,
  checkQuality,
  session,
  cookbookId,
}: {
  card: RecipeCard;
  dispatch: React.Dispatch<LayoutAction>;
  isExpanded: boolean;
  onToggleExpand: () => void;
  primaryPhoto?: string;
  imageQualities: Record<string, QualityResult>;
  checkQuality: (url: string, usage?: PrintUsage) => Promise<void>;
  session: { access_token: string } | null;
  cookbookId: string;
}) {
  // Debug logging
  console.log('[RecipeCardBody] card:', card);
  console.log('[RecipeCardBody] pages:', card.pages);

  const [showImagePicker, setShowImagePicker] = useState(false);
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Defensive: ensure pages is always an array
  const pages = Array.isArray(card.pages) ? card.pages : [];
  const imagePage = pages.find((p) => p && p.kind === 'image');
  const imageUrl = imagePage?.kind === 'image' ? imagePage.image_url : primaryPhoto;
  const imagePageId = imagePage?.id;

  // Get the current page data from the card (not a stale copy)
  const editingPage = editingPageId ? pages.find(p => p && p.id === editingPageId) : null;

  const handleOpenPageEditor = (page: RecipePage) => {
    setEditingPageId(page.id);
  };

  const handleClosePageEditor = () => {
    setEditingPageId(null);
  };

  const handleCustomImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, pageId: string) => {
    const file = e.target.files?.[0];
    if (!file || !session) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('cookbook_id', cookbookId);

      const res = await fetch('/api/print-cookbooks/upload-custom', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      });

      if (!res.ok) throw new Error('Upload failed');

      const { url } = await res.json();
      dispatch({ type: 'UPDATE_CUSTOM_PAGE', cardId: card.id, pageId, updates: { image_url: url } });
      checkQuality(url, 'full_bleed');
    } catch (err) {
      console.error('Custom image upload failed:', err);
      alert('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  // Check quality of current image
  useEffect(() => {
    if (imageUrl) {
      checkQuality(imageUrl, 'full_bleed');
    }
  }, [imageUrl, checkQuality]);

  // Check quality of all available images
  useEffect(() => {
    if (Array.isArray(card.image_urls)) {
      card.image_urls.forEach((url) => {
        checkQuality(url, 'full_bleed');
      });
    }
  }, [card.image_urls, checkQuality]);

  const currentQuality = imageUrl ? imageQualities[imageUrl] : undefined;

  const handleSelectImage = (url: string | undefined) => {
    if (imagePageId) {
      dispatch({ type: 'UPDATE_RECIPE_IMAGE', cardId: card.id, pageId: imagePageId, imageUrl: url });
    }
    setShowImagePicker(false);
  };

  return (
    <div>
      <div className="relative group">
        {imageUrl ? (
          <>
            <img
              src={proxyIfNeeded(imageUrl)}
              alt=""
              className="w-full h-24 object-cover rounded mb-3"
            />
            {currentQuality && (
              <div className="absolute top-2 left-2 bg-white/90 rounded px-1.5 py-0.5">
                <QualityBadge quality={currentQuality} />
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-24 bg-cb-bg rounded mb-3 flex items-center justify-center">
            <svg className="w-8 h-8 text-cb-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
            </svg>
          </div>
        )}
        {/* Change Image button */}
        {Array.isArray(card.image_urls) && card.image_urls.length > 0 && (
          <button
            onClick={() => setShowImagePicker(true)}
            className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center text-white text-xs font-medium"
          >
            Change Image
          </button>
        )}
      </div>
      <p className="font-medium truncate">{card.display_name}</p>

      {/* Visual page thumbnails - horizontal strip */}
      <div className="mt-3 overflow-x-auto">
        <div className="flex gap-2 pb-2">
          {pages.map((page, idx) => {
            if (!page || !page.kind) {
              console.warn('[RecipeCardBody] Invalid page at index', idx, page);
              return null;
            }
            const pageImageUrl = 'image_url' in page ? page.image_url : undefined;
            const pageText = 'text' in page ? page.text : undefined;
            const pagePart = 'part' in page ? page.part : undefined;

            return (
              <button
                key={page.id || idx}
                onClick={() => handleOpenPageEditor(page)}
                className="flex-shrink-0 w-[80px] h-[110px] rounded bg-[#FAF7F2] border border-[#E0D9D0] overflow-hidden hover:border-cb-primary/50 transition-colors"
                style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.10)' }}
                title={`Page ${idx + 1}: ${page.kind}`}
              >
                {page.kind === 'image' ? (
                  <div className="relative w-full h-full">
                    {(pageImageUrl || primaryPhoto) ? (
                      <img
                        src={proxyIfNeeded(pageImageUrl || primaryPhoto || '')}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-2xl">📷</span>
                      </div>
                    )}
                    {pageImageUrl && imageQualities[pageImageUrl] && (
                      <div className="absolute bottom-1 left-1 bg-white/90 rounded px-0.5">
                        <QualityBadge quality={imageQualities[pageImageUrl]} compact />
                      </div>
                    )}
                  </div>
                ) : page.kind === 'content' ? (
                  <div className="w-full h-full flex flex-col items-center justify-center p-2">
                    <span className="text-xl mb-1">📄</span>
                    <span className="text-[9px] text-cb-muted text-center leading-tight">
                      Part {pagePart || 1}
                    </span>
                  </div>
                ) : page.kind === 'custom' ? (
                  <div className="relative w-full h-full">
                    {pageImageUrl ? (
                      <img
                        src={proxyIfNeeded(pageImageUrl)}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : pageText ? (
                      <div className="w-full h-full p-1.5 overflow-hidden">
                        <p className="text-[8px] text-cb-secondary leading-tight line-clamp-6">
                          {pageText}
                        </p>
                      </div>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-2xl">✨</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-xl">📄</span>
                  </div>
                )}
              </button>
            );
          })}
          {/* Add page button */}
          <button
            onClick={onToggleExpand}
            className="flex-shrink-0 w-[80px] h-[110px] rounded bg-[#FAF7F2] border-2 border-dashed border-[#E0D9D0] flex items-center justify-center hover:border-cb-primary/50 transition-colors"
          >
            <svg className="w-6 h-6 text-cb-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-cb-border">
          <p className="text-xs text-cb-muted mb-2">Add a custom page:</p>
          <div className="flex gap-2">
            <button
              onClick={() => dispatch({ type: 'ADD_CUSTOM_PAGE', cardId: card.id, layout: 'image_and_text' })}
              className="flex-1 text-xs text-cb-primary py-2 border border-dashed border-cb-primary/30 rounded hover:bg-cb-primary/5 transition-colors"
            >
              + Photo & Text
            </button>
            <button
              onClick={() => dispatch({ type: 'ADD_CUSTOM_PAGE', cardId: card.id, layout: 'image_only' })}
              className="flex-1 text-xs text-cb-primary py-2 border border-dashed border-cb-primary/30 rounded hover:bg-cb-primary/5 transition-colors"
            >
              + Photo Only
            </button>
            <button
              onClick={() => dispatch({ type: 'ADD_CUSTOM_PAGE', cardId: card.id, layout: 'text_only' })}
              className="flex-1 text-xs text-cb-primary py-2 border border-dashed border-cb-primary/30 rounded hover:bg-cb-primary/5 transition-colors"
            >
              + Text Only
            </button>
          </div>
        </div>
      )}

      {/* Image Picker Modal */}
      {showImagePicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowImagePicker(false)} />
          <div className="relative bg-cb-card rounded-card p-4 max-w-md w-full shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Select Photo for Print</h3>
              <button onClick={() => setShowImagePicker(false)} className="text-cb-muted hover:text-cb-text">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 max-h-80 overflow-y-auto">
              {/* No image option */}
              <button
                onClick={() => handleSelectImage(undefined)}
                className={`relative rounded-lg overflow-hidden border-2 transition-all h-28 ${
                  !imageUrl ? 'border-cb-primary' : 'border-cb-border hover:border-cb-primary/50'
                }`}
              >
                <div className="absolute inset-0 flex items-center justify-center bg-cb-bg">
                  <span className="text-xs text-cb-muted">No Image</span>
                </div>
                {!imageUrl && (
                  <div className="absolute top-1 right-1 w-5 h-5 bg-cb-primary rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  </div>
                )}
              </button>
              {(card.image_urls || []).map((url) => {
                const quality = imageQualities[url];
                const isSelected = url === imageUrl;
                return (
                  <button
                    key={url}
                    onClick={() => handleSelectImage(url)}
                    className={`relative rounded-lg overflow-hidden border-2 transition-all h-28 ${
                      isSelected ? 'border-cb-primary' : 'border-cb-border hover:border-cb-primary/50'
                    }`}
                  >
                    <img src={proxyIfNeeded(url)} alt="" className="w-full h-full object-cover" />
                    {/* Quality badge */}
                    {quality && (
                      <div className="absolute bottom-1 left-1 bg-white/90 rounded px-1 py-0.5">
                        <QualityBadge quality={quality} />
                      </div>
                    )}
                    {/* Selected checkmark */}
                    {isSelected && (
                      <div className="absolute top-1 right-1 w-5 h-5 bg-cb-primary rounded-full flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-cb-muted mt-3">
              For best print quality, use images 2550×1650 px or larger (300 DPI).
            </p>
          </div>
        </div>
      )}

      {/* Page Editor Modal */}
      {editingPage && (() => {
        const epImageUrl = 'image_url' in editingPage ? editingPage.image_url : undefined;
        const epPart = 'part' in editingPage ? editingPage.part : 1;
        const epLayout = 'layout' in editingPage ? editingPage.layout : 'image_and_text';
        const epText = 'text' in editingPage ? editingPage.text : undefined;
        const epCaption = 'caption' in editingPage ? editingPage.caption : undefined;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={handleClosePageEditor} />
            <div className="relative bg-cb-card rounded-card p-5 max-w-lg w-full shadow-xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">
                  {editingPage.kind === 'image' ? 'Image Page' : editingPage.kind === 'content' ? 'Recipe Content' : 'Custom Page'}
                </h3>
                <button onClick={handleClosePageEditor} className="text-cb-muted hover:text-cb-text">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {editingPage.kind === 'image' && (
                <div className="space-y-4">
                  <div className="relative aspect-[8.5/5.5] bg-[#FAF7F2] rounded-lg overflow-hidden border border-[#E0D9D0]">
                    {(epImageUrl || primaryPhoto) ? (
                      <>
                        <img
                          src={proxyIfNeeded(epImageUrl || primaryPhoto || '')}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                        {(epImageUrl && imageQualities[epImageUrl]) && (
                          <div className="absolute top-2 left-2 bg-white/90 rounded px-2 py-1">
                            <QualityBadge quality={imageQualities[epImageUrl]} />
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <p className="text-sm text-cb-muted">No image selected</p>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setShowImagePicker(true);
                      handleClosePageEditor();
                    }}
                    className="w-full py-2.5 bg-cb-bg border border-cb-border rounded-input text-sm font-medium hover:border-cb-primary/50 transition-colors"
                  >
                    Change Photo
                  </button>
                </div>
              )}

              {editingPage.kind === 'content' && (
                <div className="space-y-4">
                  <div className="aspect-[8.5/11] bg-[#FAF7F2] rounded-lg border border-[#E0D9D0] p-4 flex flex-col items-center justify-center">
                    <span className="text-4xl mb-3">📄</span>
                    <p className="font-medium text-cb-text">Recipe Content — Part {epPart}</p>
                    <p className="text-sm text-cb-secondary mt-1">Title, Ingredients & Steps</p>
                  </div>
                  <p className="text-xs text-cb-muted text-center">
                    This page is auto-generated from your recipe data.
                  </p>
                </div>
              )}

              {editingPage.kind === 'custom' && (
                <div className="space-y-4">
                  {epLayout !== 'text_only' && (
                    <div>
                      <label className="block text-sm font-medium mb-2">Photo</label>
                      <div className="relative aspect-[8.5/5.5] bg-[#FAF7F2] rounded-lg overflow-hidden border border-[#E0D9D0]">
                        {epImageUrl ? (
                          <img src={proxyIfNeeded(epImageUrl)} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="text-sm text-cb-muted">No photo uploaded</span>
                          </div>
                        )}
                      </div>
                      <label className="mt-2 flex items-center justify-center py-2 bg-cb-bg border border-cb-border rounded-input cursor-pointer hover:border-cb-primary/50 transition-colors">
                        <span className="text-sm font-medium">{uploading ? 'Uploading...' : 'Upload Photo'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          onChange={(e) => handleCustomImageUpload(e, editingPage.id)}
                          disabled={uploading}
                        />
                      </label>
                    </div>
                  )}

                  {epLayout !== 'image_only' && (
                    <div>
                      <label className="block text-sm font-medium mb-2">Text (max 500 chars)</label>
                      <textarea
                        value={epText || ''}
                        onChange={(e) =>
                          dispatch({
                            type: 'UPDATE_CUSTOM_PAGE',
                            cardId: card.id,
                            pageId: editingPage.id,
                            updates: { text: e.target.value.slice(0, 500) },
                          })
                        }
                        placeholder="Add personal notes or dedication..."
                        rows={4}
                        className="w-full bg-cb-bg border border-cb-border rounded-input px-3 py-2 text-sm resize-none focus:outline-none focus:border-cb-primary"
                      />
                    </div>
                  )}

                  {epLayout !== 'text_only' && (
                    <div>
                      <label className="block text-sm font-medium mb-2">Caption (optional)</label>
                      <input
                        type="text"
                        value={epCaption || ''}
                        onChange={(e) =>
                          dispatch({
                            type: 'UPDATE_CUSTOM_PAGE',
                            cardId: card.id,
                            pageId: editingPage.id,
                            updates: { caption: e.target.value.slice(0, 100) },
                          })
                        }
                        placeholder="Photo caption..."
                        className="w-full bg-cb-bg border border-cb-border rounded-input px-3 py-2 text-sm focus:outline-none focus:border-cb-primary"
                      />
                    </div>
                  )}

                  <div className="pt-3 border-t border-cb-border">
                    <button
                      onClick={() => {
                        dispatch({ type: 'REMOVE_PAGE', cardId: card.id, pageId: editingPage.id });
                        handleClosePageEditor();
                      }}
                      className="w-full py-2 text-sm font-medium text-red-600 hover:text-red-700 transition-colors"
                    >
                      Delete This Page
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function IndexCardBody() {
  return (
    <div className="text-sm text-cb-secondary">
      <p className="font-semibold text-cb-text mb-2">Index</p>
      <p className="text-xs text-cb-muted italic">
        (Alphabetical listing, auto-generated)
      </p>
    </div>
  );
}

function BackCardBody() {
  return (
    <div className="text-center text-cb-muted">
      <div className="w-12 h-12 rounded-full bg-cb-primary/10 flex items-center justify-center mx-auto mb-2">
        <span className="text-2xl">👨‍🍳</span>
      </div>
      <p className="text-sm font-semibold text-cb-text">ChefsBook</p>
      <p className="text-xs">Your recipes, beautifully collected.</p>
      <p className="text-[10px] mt-2 text-cb-border">Reserved for branding</p>
    </div>
  );
}

function CoverSettingsPanel({
  layout,
  dispatch,
}: {
  layout: BookLayout;
  dispatch: React.Dispatch<LayoutAction>;
}) {
  const coverCard = layout.cards.find((c) => c.type === 'cover') as CoverCard | undefined;
  if (!coverCard) return null;

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Title</label>
        <input
          type="text"
          value={coverCard.title}
          onChange={(e) => dispatch({ type: 'UPDATE_COVER', payload: { title: e.target.value } })}
          className="w-full bg-cb-bg border border-cb-border rounded-input px-3 py-2 text-sm focus:outline-none focus:border-cb-primary"
          maxLength={60}
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Subtitle</label>
        <input
          type="text"
          value={coverCard.subtitle || ''}
          onChange={(e) => dispatch({ type: 'UPDATE_COVER', payload: { subtitle: e.target.value || undefined } })}
          className="w-full bg-cb-bg border border-cb-border rounded-input px-3 py-2 text-sm focus:outline-none focus:border-cb-primary"
          maxLength={80}
          placeholder="Optional subtitle"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Author</label>
        <input
          type="text"
          value={coverCard.author}
          onChange={(e) => dispatch({ type: 'UPDATE_COVER', payload: { author: e.target.value } })}
          className="w-full bg-cb-bg border border-cb-border rounded-input px-3 py-2 text-sm focus:outline-none focus:border-cb-primary"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-2">Template Style</label>
        <div className="grid grid-cols-3 gap-2">
          {['classic', 'modern', 'minimal', 'heritage', 'nordic', 'bbq'].map((style) => (
            <button
              key={style}
              onClick={() => dispatch({ type: 'UPDATE_COVER', payload: { cover_style: style } })}
              className={`p-2 rounded-input border text-xs font-medium capitalize ${
                coverCard.cover_style === style
                  ? 'border-cb-primary bg-cb-primary/5 text-cb-primary'
                  : 'border-cb-border hover:border-cb-primary/50'
              }`}
            >
              {style}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-2">Book Language</label>
        <select
          value={layout.language}
          onChange={(e) => {
            const newLayout = { ...layout, language: e.target.value as BookLayout['language'] };
            dispatch({ type: 'SET_LAYOUT', payload: newLayout });
          }}
          className="w-full bg-cb-bg border border-cb-border rounded-input px-3 py-2 text-sm focus:outline-none focus:border-cb-primary"
        >
          <option value="en">English (EN)</option>
          <option value="fr">Français (FR)</option>
          <option value="es">Español (ES)</option>
          <option value="it">Italiano (IT)</option>
          <option value="de">Deutsch (DE)</option>
        </select>
        <p className="text-xs text-cb-muted mt-1">Affects TOC, Index, and section headers in the PDF.</p>
      </div>
    </div>
  );
}
