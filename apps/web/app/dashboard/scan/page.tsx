'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase, createRecipe, createTechnique, checkRecipeLimit } from '@chefsbook/db';
import { scanRecipe } from '@chefsbook/ai';
import { createRecipeWithModeration } from '@/lib/saveWithModeration';
import { useConfirmDialog } from '@/components/useConfirmDialog';

// ─── Bookmark types ─────────────────────────────────────────────

interface Bookmark {
  title: string;
  url: string;
  folder: string;
  selected: boolean;
  isDuplicate?: boolean;
  existingTitle?: string;
}

interface ImportResult {
  title: string;
  url: string;
  folder: string;
  status: 'imported' | 'skipped' | 'failed';
  error?: string;
}

type BookmarkPhase = 'idle' | 'checking' | 'preview' | 'importing' | 'done';

// ─── Main page ──────────────────────────────────────────────────

export default function ScanPage() {
  const [confirm, ConfirmDialog] = useConfirmDialog();
  const router = useRouter();

  // Image / URL state
  const [url, setUrl] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [loading, setLoading] = useState<'image' | 'url' | 'text' | null>(null);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  // Bookmark import state
  const [bmPhase, setBmPhase] = useState<BookmarkPhase>('idle');
  const [bmDragOver, setBmDragOver] = useState(false);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const [importTotal, setImportTotal] = useState(0);
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [showFailed, setShowFailed] = useState(false);
  const abortRef = useRef(false);

  // (Voice recording moved to /dashboard/speak)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // ── Check pro + speech support + resume import ──
  useEffect(() => {
    const activeJobId = localStorage.getItem('chefsbook_import_job');
    if (activeJobId) {
      setBmPhase('importing');
      startPolling(activeJobId);
    }
    // (Voice + pro check moved to /dashboard/speak)
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const startPolling = (jobId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);

    const poll = async () => {
      try {
        const res = await fetch(`/api/import/batch?jobId=${jobId}`);
        if (!res.ok) {
          clearPolling();
          return;
        }
        const { job, urls } = await res.json();

        const total = job.total_urls ?? urls.length;
        const processed = urls.filter((u: any) => u.status !== 'queued' && u.status !== 'processing');
        setImportTotal(total);
        setImportProgress(processed.length);
        setImportResults(
          processed.map((u: any) => ({
            title: u.url,
            url: u.url,
            folder: u.folder_name ?? '',
            status: u.status === 'success' ? 'imported' as const : u.status === 'not_recipe' ? 'skipped' as const : 'failed' as const,
            error: u.error_message,
          }))
        );

        if (job.status === 'complete' || job.status === 'failed') {
          clearPolling();
          setBmPhase('done');
        }
      } catch {
        // network error — keep polling
      }
    };

    poll(); // immediate first poll
    pollRef.current = setInterval(poll, 2000);
  };

  const clearPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    localStorage.removeItem('chefsbook_import_job');
  };

  // ── Image handlers ──

  const handleImage = async (file: File) => {
    setLoading('image');
    setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');
      const gate = await checkRecipeLimit(user.id);
      if (!gate.allowed) throw new Error(gate.reason!);
      const base64 = await fileToBase64(file);
      const scanned = await scanRecipe(base64, file.type || 'image/jpeg');
      const { recipe, moderation } = await createRecipeWithModeration(user.id, scanned);
      if (moderation.verdict !== 'clean') alert(moderation.verdict === 'mild' ? 'Recipe saved but is under review.' : 'Recipe flagged — your account is under review.');
      router.push(`/recipe/${recipe.id}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(null);
    }
  };

  const isYouTubeUrl = (u: string) =>
    /(?:youtube\.com\/watch|youtu\.be\/|youtube\.com\/shorts\/)/.test(u);

  const isInstagramUrl = (u: string) =>
    /instagram\.com\/(p|reel|tv)\//.test(u);

  const handleUrlImport = async () => {
    if (!url.trim()) return;
    if (isInstagramUrl(url.trim())) {
      setError('Instagram import is no longer supported. Take a screenshot of the post and use Photo Import — we\'ll read the photo and caption.');
      return;
    }
    setLoading('url');
    setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');

      // Plan limit check
      const gate = await checkRecipeLimit(user.id);
      if (!gate.allowed) throw new Error(gate.reason!);

      // Duplicate check: warn if URL already imported
      const { data: existing } = await supabase
        .from('recipes')
        .select('id, title')
        .eq('user_id', user.id)
        .eq('source_url', url.trim())
        .limit(1);
      if (existing?.length) {
        const proceed = await confirm({ icon: '\u26A0\uFE0F', title: 'Duplicate URL', body: `You already have "${existing[0].title}" from this URL. Import again?`, confirmLabel: 'Import Again', variant: 'positive' });
        if (!proceed) { setLoading(null); return; }
      }

      const endpoint = isYouTubeUrl(url) ? '/api/import/youtube' : '/api/import/url';
      // Pass user's preferred language for import-time translation
      const storedLang = typeof localStorage !== 'undefined' ? localStorage.getItem('chefsbook-language') : null;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, userLanguage: storedLang || 'en' }),
      });
      const data = await res.json();
      if (!res.ok && res.status !== 206) throw new Error(data.error || 'Import failed');

      // Handle extension fallback signal — for both 206 hard blocks and incomplete extractions
      if (data.needsBrowserExtraction) {
        // Check if extension is installed (content script sets a data attribute on <html>)
        const hasExtension = typeof document !== 'undefined' && document.documentElement.hasAttribute('data-chefsbook-extension');
        if (hasExtension && !data.recipe) {
          // Hard block (no recipe at all) — hand off to extension silently
          window.postMessage({ type: 'CHEFSBOOK_PDF_IMPORT', url }, '*');
          setLoading(null);
          return;
        }
        // If we have a partial recipe but extension could do better, show a hint
        if (data.incompleteMessage) {
          console.log('Import incomplete — extension could improve:', data.incompleteMessage);
          // Continue with partial recipe if we have one, but show the warning
        }
        // If no extension and hard block, show error
        if (!data.recipe) {
          throw new Error(data.incompleteMessage || data.message || 'This site requires the ChefsBook browser extension for full import.');
        }
      }

      // Warm-discovery signal: store the message for the next page to show.
      if (data.discovery?.isNew && typeof window !== 'undefined') {
        sessionStorage.setItem('chefsbook_discovery', JSON.stringify(data.discovery));
      }

      // Route by content type
      if (data.contentType === 'technique' && !data.videoOnly) {
        // Technique extracted
        const technique = await createTechnique(user.id, {
          ...data.technique,
          source_url: url,
          source_type: isYouTubeUrl(url) ? 'youtube' : 'web',
          youtube_video_id: data.videoId ?? null,
          image_url: data.thumbnail ?? data.imageUrl ?? null,
        });
        router.push(`/technique/${technique.id}`);
      } else if (data.videoOnly) {
        // No content extracted — save as video bookmark
        const { recipe } = await createRecipeWithModeration(user.id, {
          title: data.title,
          description: data.description,
          servings: null,
          prep_minutes: null,
          cook_minutes: null,
          cuisine: null,
          course: null,
          ingredients: [],
          steps: [],
          notes: null,
          source_type: 'youtube',
          source_url: url,
          image_url: data.thumbnail,
          youtube_video_id: data.videoId,
          channel_name: data.channelName,
          video_only: true,
        });
        router.push(`/recipe/${recipe.id}`);
      } else {
        // Recipe extracted
        const recipeData = {
          ...data.recipe,
          source_url: url,
          image_url: data.thumbnail ?? data.imageUrl ?? undefined,
          youtube_video_id: data.videoId ?? undefined,
          channel_name: data.channelName ?? undefined,
          is_new_discovery: !!data.discovery?.isNew,
        };
        if (data.titleGenerated) {
          recipeData.tags = [...(recipeData.tags ?? []), '_unresolved'];
        }
        const { recipe } = await createRecipeWithModeration(user.id, recipeData);
        router.push(`/recipe/${recipe.id}`);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(null);
    }
  };

  const handlePasteImport = async () => {
    if (!pasteText.trim() || loading) return;
    setError('');
    setLoading('text');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');
      const gate = await checkRecipeLimit(user.id);
      if (!gate.allowed) throw new Error(gate.reason!);

      const storedLang = typeof localStorage !== 'undefined' ? localStorage.getItem('chefsbook-language') : null;
      const res = await fetch('/api/import/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: pasteText, userLanguage: storedLang || 'en' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');

      const recipeData = { ...data.recipe, source_type: 'text' };
      const { recipe } = await createRecipeWithModeration(user.id, recipeData);
      router.push(`/recipe/${recipe.id}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(null);
    }
  };

  const onImageDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith('image/')) handleImage(file);
  }, []);

  // ── Bookmark handlers ──

  const parseBookmarksHtml = (html: string): Bookmark[] => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const results: Bookmark[] = [];

    const walk = (node: Element, folder: string) => {
      let currentFolder = folder;

      for (const child of Array.from(node.children)) {
        const tag = child.tagName;

        if (tag === 'DT') {
          const h3 = Array.from(child.children).find(c => c.tagName === 'H3');
          if (h3) {
            currentFolder = h3.textContent?.trim() || folder;
          }

          const a = Array.from(child.children).find(c => c.tagName === 'A');
          if (a) {
            const href = a.getAttribute('href');
            if (href?.startsWith('http')) {
              results.push({
                title: a.textContent?.trim() || href,
                url: href,
                folder: currentFolder || 'Uncategorised',
                selected: true,
              });
            }
          }

          walk(child, currentFolder);
        } else if (tag === 'DL') {
          walk(child, currentFolder);
        }
      }
    };

    const root = doc.querySelector('dl') || doc.body;
    walk(root, 'Bookmarks');
    return results;
  };

  // ── Universal file import ──
  const [fileRecipes, setFileRecipes] = useState<any[]>([]);
  const [fileType, setFileType] = useState('');
  const [fileError, setFileError] = useState('');

  const handleFileImport = async (file: File) => {
    setBmPhase('checking');
    setFileError('');
    setFileType('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/import/file', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok || data.error) {
        setFileError(data.error || 'Failed to process file');
        setBmPhase('idle');
        setError(data.error || 'Failed to process file');
        return;
      }
      setFileType(data.fileType);
      if (data.recipes?.length > 0) {
        // Convert to bookmark-like format for the existing review UI
        const mapped = data.recipes.map((r: any, i: number) => ({
          title: r.title || `Recipe ${i + 1}`,
          url: '',
          folder: r.section_hint || data.fileType || 'Recipes',
          selected: true,
          isDuplicate: false,
          existingTitle: undefined,
          _recipe: r, // store full recipe for direct import
        }));
        setBookmarks(mapped);
        setFileRecipes(data.recipes);
        setExpandedFolders(new Set(mapped.map((b: any) => b.folder)));
        setBmPhase('preview');
      } else {
        setFileError('No recipes found in this file');
        setBmPhase('idle');
        setError('No recipes found in this file');
      }
    } catch (e: any) {
      setFileError(e.message);
      setBmPhase('idle');
      setError(e.message);
    }
  };

  const handleBookmarkFile = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    const isHtml = ext === 'html' || ext === 'htm' || file.type === 'text/html';

    if (!isHtml) {
      // Non-HTML file → route through universal file import API
      handleFileImport(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const html = reader.result as string;
      const parsed = parseBookmarksHtml(html);
      setBookmarks(parsed);
      setBmPhase('checking');

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: existing } = await supabase
            .from('recipes')
            .select('title, source_url')
            .eq('user_id', user.id);

          if (existing?.length) {
            const urlMap = new Map<string, string>();
            const titleMap = new Map<string, string>();
            for (const r of existing) {
              if (r.source_url) urlMap.set(r.source_url, r.title ?? r.source_url);
              if (r.title) titleMap.set(r.title.toLowerCase(), r.title);
            }

            setBookmarks(parsed.map((b) => {
              const urlMatch = urlMap.get(b.url);
              if (urlMatch) {
                return { ...b, isDuplicate: true, existingTitle: urlMatch, selected: false };
              }
              const titleMatch = titleMap.get(b.title.toLowerCase());
              if (titleMatch) {
                return { ...b, isDuplicate: true, existingTitle: titleMatch, selected: false };
              }
              return b;
            }));
          }
        }
      } catch {
        // Duplicate check failed — proceed without marking
      }

      setExpandedFolders(new Set(parsed.map((b) => b.folder)));
      setBmPhase('preview');
    };
    reader.readAsText(file);
  };

  const onBookmarkDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setBmDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleBookmarkFile(file);
  };

  const toggleBookmark = (index: number) => {
    setBookmarks((prev) =>
      prev.map((b, i) => (i === index ? { ...b, selected: !b.selected } : b))
    );
  };

  const toggleFolder = (folder: string, selected: boolean) => {
    setBookmarks((prev) =>
      prev.map((b) => (b.folder === folder ? { ...b, selected } : b))
    );
  };

  const toggleExpand = (folder: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folder)) next.delete(folder);
      else next.add(folder);
      return next;
    });
  };

  const selectedCount = bookmarks.filter((b) => b.selected).length;
  const duplicateCount = bookmarks.filter((b) => b.isDuplicate).length;
  const folders = [...new Set(bookmarks.map((b) => b.folder))];

  const startBookmarkImport = async () => {
    const selected = bookmarks.filter((b) => b.selected);
    if (selected.length === 0) return;

    // Check if these are file-extracted recipes (have _recipe data, no URLs)
    const hasDirectRecipes = selected.some((b: any) => b._recipe);

    if (hasDirectRecipes) {
      // Direct import from file — save each recipe immediately
      setBmPhase('importing');
      setImportProgress(0);
      setImportTotal(selected.length);
      setImportResults([]);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError('Not signed in'); setBmPhase('preview'); return; }

      let imported = 0;
      for (const bm of selected) {
        const r = (bm as any)._recipe;
        if (!r) continue;
        try {
          await createRecipe(user.id, { ...r, source_type: r.source_type || 'manual' });
          imported++;
          setImportProgress(imported);
          setImportResults((prev) => [...prev, { title: r.title || bm.title, url: '', folder: bm.folder, status: 'imported' as const }]);
        } catch (e: any) {
          setImportResults((prev) => [...prev, { title: r.title || bm.title, url: '', folder: bm.folder, status: 'failed' as const, error: e.message }]);
        }
      }
      setBmPhase('done');
      return;
    }

    // Standard bookmark URL batch import
    setBmPhase('importing');
    setImportProgress(0);
    setImportTotal(selected.length);
    setImportResults([]);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setError('Not signed in');
      setBmPhase('preview');
      return;
    }

    try {
      const res = await fetch('/api/import/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          urls: selected.map((b) => ({ url: b.url, folder: b.folder })),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start import');

      localStorage.setItem('chefsbook_import_job', data.jobId);
      startPolling(data.jobId);
    } catch (e: any) {
      setError(e.message);
      setBmPhase('preview');
    }
  };

  const importedCount = importResults.filter((r) => r.status === 'imported').length;
  const skippedCount = importResults.filter((r) => r.status === 'skipped').length;
  const failedCount = importResults.filter((r) => r.status === 'failed').length;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-2">Import Recipe</h1>
      <p className="text-cb-secondary text-sm mb-8">
        Scan a photo, paste a URL, or import your browser bookmarks.
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-cb-primary rounded-input p-3 mb-6 text-sm">
          {error}
        </div>
      )}

      {/* Top row: Image + URL (side by side) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Image upload */}
        <div data-onboard="scan" className="bg-cb-card border border-cb-border rounded-card p-6">
          <h2 className="font-semibold mb-1">Scan from image</h2>
          <p className="text-cb-secondary text-sm mb-4">
            Upload a photo of a handwritten card, cookbook page, or printed recipe.
          </p>
          <div
            onDrop={onImageDrop}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            className={`border-2 border-dashed rounded-card p-12 text-center transition-colors ${
              dragOver ? 'border-cb-primary bg-cb-primary/5' : 'border-cb-border'
            }`}
          >
            {loading === 'image' ? (
              <div className="text-cb-secondary">
                <Spinner className="mx-auto mb-3" />
                <p className="text-sm font-medium">Extracting recipe...</p>
                <p className="text-xs mt-1">Claude is reading your image</p>
              </div>
            ) : (
              <>
                <svg className="w-10 h-10 text-cb-secondary mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                </svg>
                <p className="text-cb-secondary text-sm mb-4">Drag & drop a recipe image here</p>
                <label className="inline-block bg-cb-primary text-white px-6 py-2.5 rounded-input text-sm font-semibold cursor-pointer hover:opacity-90 transition-opacity">
                  Choose File
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImage(file);
                  }} />
                </label>
              </>
            )}
          </div>
        </div>

        {/* URL import */}
        <div data-onboard="url" className="bg-cb-card border border-cb-border rounded-card p-6">
          <h2 className="font-semibold mb-1">Import from URL</h2>
          <p className="text-cb-secondary text-sm mb-4">
            Paste a link to any recipe page. We strip the life story and extract just the recipe.
          </p>
          <div className="space-y-4">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/recipe..."
              className="w-full bg-cb-bg border border-cb-border rounded-input px-4 py-3 text-sm placeholder:text-cb-secondary/60 outline-none focus:border-cb-primary transition-colors"
            />
            <button
              onClick={handleUrlImport}
              disabled={!url.trim() || loading !== null}
              className="w-full bg-cb-green text-white py-3 rounded-input text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading === 'url' ? (
                <><Spinner size={16} /> {isYouTubeUrl(url) ? 'Importing from YouTube...' : 'Importing...'}</>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  Import Recipe
                </>
              )}
            </button>
          </div>
          <div className="mt-6 p-4 bg-cb-bg rounded-input">
            <p className="text-xs text-cb-secondary leading-relaxed">
              Works with most recipe websites and YouTube cooking videos.
              YouTube imports include timestamp-linked steps.
            </p>
          </div>
        </div>
      </div>

      {/* Paste text import */}
      <div className="bg-cb-card border border-cb-border rounded-card p-6 mb-8">
        <h2 className="font-semibold mb-1">Paste recipe text</h2>
        <p className="text-cb-secondary text-sm mb-4">
          Copy recipe text from any source — ingredients, steps, or the full recipe. AI will extract and structure it.
        </p>
        <textarea
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          placeholder="Paste recipe text here — ingredients, steps, or the full recipe. AI will extract and structure it for you."
          rows={6}
          className="w-full bg-cb-bg border border-cb-border rounded-input px-4 py-3 text-sm placeholder:text-cb-secondary/60 outline-none focus:border-cb-primary transition-colors resize-none mb-3"
        />
        <button
          onClick={handlePasteImport}
          disabled={!pasteText.trim() || loading !== null}
          className="w-full bg-cb-green text-white py-3 rounded-input text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading === 'text' ? (
            <><Spinner size={16} /> Parsing recipe...</>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" />
              </svg>
              Import from text
            </>
          )}
        </button>
      </div>

      {/* Voice recipe link */}
      <Link href="/dashboard/speak" data-onboard="speak" className="block bg-cb-card border border-cb-border rounded-card p-6 mb-8 hover:border-cb-primary/50 transition-colors">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-cb-primary/10 flex items-center justify-center shrink-0">
            <svg className="w-6 h-6 text-cb-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" /></svg>
          </div>
          <div>
            <h2 className="font-semibold">Speak a recipe</h2>
            <p className="text-cb-secondary text-sm">Dictate a recipe and AI will format it for you. <span className="text-amber-600 text-xs font-medium">Pro</span></p>
          </div>
          <svg className="w-5 h-5 text-cb-secondary ml-auto shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
        </div>
      </Link>

      {/* File import panel */}
      <div className="bg-cb-card border border-cb-border rounded-card p-6">
        <h2 className="font-semibold mb-1">Import from File</h2>
        <p className="text-cb-secondary text-sm mb-4">
          Upload any file — bookmarks, PDFs, Word docs, or text files. We'll find all the recipes inside.
        </p>

        {/* Phase: idle — drop zone */}
        {bmPhase === 'idle' && (
          <>
            <div
              onDrop={onBookmarkDrop}
              onDragOver={(e) => { e.preventDefault(); setBmDragOver(true); }}
              onDragLeave={() => setBmDragOver(false)}
              className={`border-2 border-dashed rounded-card p-10 text-center transition-colors mb-4 ${
                bmDragOver ? 'border-cb-primary bg-cb-primary/5' : 'border-cb-border'
              }`}
            >
              <svg className="w-10 h-10 text-cb-secondary mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" />
              </svg>
              <p className="text-cb-secondary text-sm mb-4">
                Drag & drop any file here <span className="text-[10px] text-cb-secondary block mt-1">PDF, Word, HTML, Text, CSV, JSON</span>
              </p>
              <label className="inline-block bg-cb-primary text-white px-6 py-2.5 rounded-input text-sm font-semibold cursor-pointer hover:opacity-90 transition-opacity">
                Choose File
                <input type="file" accept=".html,.htm,.pdf,.docx,.doc,.txt,.rtf,.csv,.json" className="hidden" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleBookmarkFile(file);
                }} />
              </label>
            </div>

            <div className="bg-cb-bg rounded-input p-3">
              <p className="text-xs text-cb-secondary leading-relaxed">
                Supports: PDF cookbooks, Word documents, text files, CSV spreadsheets, JSON exports, and browser bookmark HTML files. Max 50MB.
              </p>
            </div>
          </>
        )}

        {/* Phase: checking — duplicate detection */}
        {bmPhase === 'checking' && (
          <div className="py-12 text-center">
            <Spinner className="mx-auto mb-3" />
            <p className="text-sm font-medium">Checking for duplicates...</p>
            <p className="text-xs text-cb-secondary mt-1">
              Found {bookmarks.length} bookmarks, checking against your recipes
            </p>
          </div>
        )}

        {/* Phase: preview — folder tree */}
        {bmPhase === 'preview' && (
          <>
            {/* Header: summary + actions */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-medium">Review bookmarks</p>
                <p className="text-xs text-cb-secondary mt-0.5">
                  Click folders to expand. Check items to import.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { setBmPhase('idle'); setBookmarks([]); setExpandedFolders(new Set()); }}
                  className="text-sm text-cb-secondary hover:text-cb-text"
                >
                  Cancel
                </button>
                <button
                  onClick={startBookmarkImport}
                  disabled={selectedCount === 0}
                  className="bg-cb-primary text-white px-5 py-2.5 rounded-input text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  Import {selectedCount} selected recipe{selectedCount !== 1 ? 's' : ''}
                </button>
              </div>
            </div>

            {/* Tree */}
            <div className="max-h-[500px] overflow-y-auto border border-cb-border rounded-card">
              {folders.map((folder) => {
                const folderBms = bookmarks.filter((b) => b.folder === folder);
                const allSelected = folderBms.every((b) => b.selected);
                const noneSelected = folderBms.every((b) => !b.selected);
                const expanded = expandedFolders.has(folder);
                const folderDupes = folderBms.filter((b) => b.isDuplicate).length;

                return (
                  <div key={folder}>
                    {/* Folder row */}
                    <div
                      onClick={() => toggleExpand(folder)}
                      className="flex items-center gap-2 px-3 py-2.5 hover:bg-cb-bg/50 cursor-pointer border-b border-cb-border select-none"
                    >
                      {/* Chevron */}
                      <svg
                        className={`w-3.5 h-3.5 text-cb-secondary shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                      </svg>

                      {/* Folder checkbox */}
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleFolder(folder, !allSelected); }}
                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                          allSelected
                            ? 'bg-cb-primary border-cb-primary text-white'
                            : noneSelected
                              ? 'border-cb-border'
                              : 'bg-cb-primary border-cb-primary text-white'
                        }`}
                      >
                        {allSelected && (
                          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                          </svg>
                        )}
                        {!allSelected && !noneSelected && (
                          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" d="M5 12h14" />
                          </svg>
                        )}
                      </button>

                      {/* Folder icon */}
                      <svg className="w-4 h-4 text-cb-secondary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
                      </svg>

                      {/* Folder name */}
                      <span className="text-sm font-medium truncate">{folder}</span>

                      {/* Spacer + counts */}
                      <span className="text-xs text-cb-secondary ml-auto shrink-0">
                        {folderBms.filter((b) => b.selected).length}/{folderBms.length}
                      </span>
                      {folderDupes > 0 && (
                        <span className="text-[10px] text-amber-600 shrink-0">
                          {folderDupes} dup{folderDupes !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>

                    {/* Bookmark rows (visible when expanded) */}
                    {expanded && folderBms.map((bm) => {
                      const globalIndex = bookmarks.indexOf(bm);
                      const hostname = (() => { try { return new URL(bm.url).hostname; } catch { return ''; } })();

                      return (
                        <div
                          key={globalIndex}
                          onClick={() => toggleBookmark(globalIndex)}
                          className={`flex items-center gap-2 pl-12 pr-3 py-1.5 cursor-pointer transition-colors border-b border-cb-border/50 last:border-b-0 ${
                            bm.isDuplicate ? 'bg-amber-50/30 hover:bg-amber-50/60' : 'hover:bg-cb-bg/50'
                          }`}
                        >
                          {/* Bookmark checkbox */}
                          <span
                            className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                              bm.selected
                                ? 'bg-cb-primary border-cb-primary text-white'
                                : 'border-cb-border'
                            }`}
                          >
                            {bm.selected && (
                              <svg className="w-2 h-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                              </svg>
                            )}
                          </span>

                          {/* Favicon */}
                          <img
                            src={`https://www.google.com/s2/favicons?domain=${hostname}&sz=16`}
                            alt=""
                            className="w-4 h-4 shrink-0"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />

                          {/* Title + URL + duplicate hint */}
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm truncate ${bm.isDuplicate ? 'text-cb-secondary' : ''}`}>{bm.title}</p>
                            <p className="text-[10px] text-cb-secondary truncate">{bm.url}</p>
                            {bm.isDuplicate && bm.existingTitle && (
                              <p className="text-[10px] text-amber-600 truncate">Already imported: {bm.existingTitle}</p>
                            )}
                          </div>

                          {/* Warning icon for duplicates */}
                          {bm.isDuplicate && (
                            <svg className="w-4 h-4 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                            </svg>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* Footer summary */}
            <div className="mt-3 px-1 text-xs text-cb-secondary">
              {folders.length} folder{folders.length !== 1 ? 's' : ''} &middot;{' '}
              {bookmarks.length} bookmark{bookmarks.length !== 1 ? 's' : ''} found &middot;{' '}
              <span className="font-semibold text-cb-green">{selectedCount} selected</span>
              {duplicateCount > 0 && (
                <> &middot; <span className="font-semibold text-amber-600">{duplicateCount} skipped</span></>
              )}
            </div>
          </>
        )}

        {/* Phase: importing — progress */}
        {bmPhase === 'importing' && (
          <div className="py-8">
            {/* Progress bar */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold">
                  {importProgress} of {importTotal} processed
                </p>
                <p className="text-xs text-cb-secondary">
                  {importTotal > 0 ? Math.round((importProgress / importTotal) * 100) : 0}%
                </p>
              </div>
              <div className="w-full h-2 bg-cb-bg rounded-full overflow-hidden">
                <div
                  className="h-full bg-cb-primary rounded-full transition-all duration-300"
                  style={{ width: `${importTotal > 0 ? (importProgress / importTotal) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Live feed */}
            <div className="max-h-[300px] overflow-y-auto space-y-1">
              {importResults.slice(-20).reverse().map((r, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-input ${
                    r.status === 'imported'
                      ? 'bg-green-50 text-green-700'
                      : r.status === 'skipped'
                      ? 'bg-amber-50 text-amber-700'
                      : 'bg-red-50 text-red-700'
                  }`}
                >
                  <span className="shrink-0">
                    {r.status === 'imported' ? '✓' : r.status === 'skipped' ? '–' : '✗'}
                  </span>
                  <span className="truncate flex-1">{r.title}</span>
                  {r.folder && (
                    <span className="text-[10px] opacity-70 shrink-0">{r.folder}</span>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={() => { abortRef.current = true; }}
              className="mt-4 text-sm text-cb-secondary hover:text-cb-primary"
            >
              Stop importing
            </button>
          </div>
        )}

        {/* Phase: done — summary */}
        {bmPhase === 'done' && (
          <div className="py-8 text-center">
            <div className="w-16 h-16 rounded-full bg-cb-green/10 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-cb-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            </div>
            <h3 className="text-xl font-bold mb-2">Import complete</h3>
            <p className="text-cb-secondary mb-6">
              <span className="font-semibold text-cb-green">{importedCount} imported</span>
              {skippedCount > 0 && (
                <> &middot; <span className="font-semibold text-amber-600">{skippedCount} skipped</span> <span className="text-xs">(not recipes)</span></>
              )}
              {failedCount > 0 && (
                <> &middot; <span className="font-semibold text-cb-primary">{failedCount} failed</span></>
              )}
            </p>

            {/* Failed list (collapsible) */}
            {failedCount > 0 && (
              <div className="text-left max-w-lg mx-auto mb-6">
                <button
                  onClick={() => setShowFailed(!showFailed)}
                  className="text-sm text-cb-secondary hover:text-cb-text flex items-center gap-1"
                >
                  <svg
                    className={`w-3 h-3 transition-transform ${showFailed ? 'rotate-90' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>
                  {failedCount} failed URL{failedCount !== 1 ? 's' : ''}
                </button>
                {showFailed && (
                  <div className="mt-2 space-y-1">
                    {importResults
                      .filter((r) => r.status === 'failed')
                      .map((r, i) => (
                        <div key={i} className="bg-red-50 rounded-input px-3 py-2 text-xs">
                          <p className="font-medium text-red-700 truncate">{r.title}</p>
                          <p className="text-red-500 truncate">{r.url}</p>
                          {r.error && <p className="text-red-400 mt-0.5">{r.error}</p>}
                        </div>
                      ))}
                    <button
                      onClick={async () => {
                        const failedUrls = importResults
                          .filter((r) => r.status === 'failed')
                          .map((r) => ({ url: r.url, folder: r.folder }));
                        if (failedUrls.length === 0) return;
                        setBmPhase('importing');
                        setImportProgress(0);
                        setImportTotal(failedUrls.length);
                        setImportResults([]);
                        const { data: { session } } = await supabase.auth.getSession();
                        if (!session) return;
                        try {
                          const res = await fetch('/api/import/batch', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
                            body: JSON.stringify({ urls: failedUrls }),
                          });
                          const data = await res.json();
                          if (!res.ok) throw new Error(data.error);
                          localStorage.setItem('chefsbook_import_job', data.jobId);
                          startPolling(data.jobId);
                        } catch (e: any) {
                          setError(e.message);
                          setBmPhase('done');
                        }
                      }}
                      className="mt-2 w-full bg-cb-primary text-white py-2 rounded-input text-xs font-semibold hover:opacity-90"
                    >
                      Retry {failedCount} failed URL{failedCount !== 1 ? 's' : ''}
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => router.push('/dashboard')}
                className="bg-cb-green text-white px-6 py-2.5 rounded-input text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                View my recipes
              </button>
              <button
                onClick={() => {
                  setBmPhase('idle');
                  setBookmarks([]);
                  setImportResults([]);
                  setImportProgress(0);
                  setImportTotal(0);
                  clearPolling();
                }}
                className="border border-cb-border px-6 py-2.5 rounded-input text-sm font-medium text-cb-secondary hover:text-cb-text transition-colors"
              >
                Import more
              </button>
            </div>
          </div>
        )}
      </div>
      <ConfirmDialog />
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────

function Spinner({ className = '', size = 32 }: { className?: string; size?: number }) {
  return (
    <svg
      className={`animate-spin text-cb-primary ${className}`}
      width={size}
      height={size}
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1] ?? '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
