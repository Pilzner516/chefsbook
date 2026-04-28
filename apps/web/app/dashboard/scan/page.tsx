'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase, createRecipe, createTechnique, checkRecipeLimit, saveRecipe } from '@chefsbook/db';
import { createRecipeWithModeration } from '@/lib/saveWithModeration';
import { useConfirmDialog, useAlertDialog } from '@/components/useConfirmDialog';
import {
  Mic,
  Camera,
  ImagePlus,
  Link as LinkIcon,
  CirclePlay,
  ClipboardPaste,
  PenLine,
  Lightbulb,
  Globe,
  X,
  ChevronRight,
  ChevronDown,
  Folder,
  AlertTriangle,
  Check,
} from 'lucide-react';

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

// ─── Import method card data ────────────────────────────────────

const IMPORT_METHODS = [
  { id: 'scan', icon: Camera, title: 'Scan Photo', subtitle: 'Cookbook or recipe card' },
  { id: 'choose', icon: ImagePlus, title: 'Choose Photo', subtitle: 'From your gallery' },
  { id: 'url', icon: LinkIcon, title: 'Import URL', subtitle: 'Paste any recipe link' },
  { id: 'youtube', icon: CirclePlay, title: 'YouTube', subtitle: 'Import from any video' },
  { id: 'paste', icon: ClipboardPaste, title: 'Paste Text', subtitle: 'AI parses any format' },
  { id: 'manual', icon: PenLine, title: 'Manual Entry', subtitle: 'Type it yourself' },
] as const;

type ImportMethod = typeof IMPORT_METHODS[number]['id'];

// ─── Main page ──────────────────────────────────────────────────

export default function ScanPage() {
  const [confirm, ConfirmDialog] = useConfirmDialog();
  const [showAlert, AlertDialog] = useAlertDialog();
  const router = useRouter();

  // Active panel state
  const [activeMethod, setActiveMethod] = useState<ImportMethod | null>(null);

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

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Check pro + resume import ──
  useEffect(() => {
    const activeJobId = localStorage.getItem('chefsbook_import_job');
    if (activeJobId) {
      setBmPhase('importing');
      startPolling(activeJobId);
    }
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

    poll();
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
      const scanRes = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType: file.type || 'image/jpeg' }),
      });
      if (!scanRes.ok) {
        const err = await scanRes.json();
        throw new Error(err.error || 'Scan failed');
      }
      const scanned = await scanRes.json();
      const { recipe, moderation } = await createRecipeWithModeration(user.id, scanned);
      if (moderation.verdict !== 'clean') showAlert({ title: 'Under Review', body: moderation.verdict === 'mild' ? 'Recipe saved but is under review.' : 'Recipe flagged — your account is under review.' });
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
      setError('Instagram import is no longer supported. Take a screenshot of the post and use Scan Photo — we\'ll read the photo and caption.');
      return;
    }
    setLoading('url');
    setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');

      const gate = await checkRecipeLimit(user.id);
      if (!gate.allowed) throw new Error(gate.reason!);

      const { data: existing } = await supabase
        .from('recipes')
        .select('id, title')
        .eq('user_id', user.id)
        .eq('source_url', url.trim())
        .limit(1);
      if (existing?.length) {
        const proceed = await confirm({ icon: '⚠️', title: 'Duplicate URL', body: `You already have "${existing[0].title}" from this URL. Import again?`, confirmLabel: 'Import Again', variant: 'positive' });
        if (!proceed) { setLoading(null); return; }
      }

      const storedLang = typeof localStorage !== 'undefined' ? localStorage.getItem('chefsbook-language') : null;

      if (isYouTubeUrl(url)) {
        const classifyRes = await fetch('/api/import/youtube', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, classifyOnly: true }),
        });
        const classifyData = await classifyRes.json();
        if (!classifyRes.ok) throw new Error(classifyData.error || 'Classification failed');

        const aiSuggestedType = classifyData.contentType;
        const otherType = aiSuggestedType === 'recipe' ? 'technique' : 'recipe';
        const capitalizedSuggested = aiSuggestedType.charAt(0).toUpperCase() + aiSuggestedType.slice(1);
        const capitalizedOther = otherType.charAt(0).toUpperCase() + otherType.slice(1);

        const confirmed = await confirm({
          icon: '🧑‍🍳',
          title: "Your Sous Chef's best guess",
          body: `This looks like a **${capitalizedSuggested}** to us. Does that look right?`,
          confirmLabel: `Yes, it's a ${capitalizedSuggested}`,
          cancelLabel: `No, it's a ${capitalizedOther}`,
        });

        const confirmedType = confirmed ? aiSuggestedType : otherType;

        const extractRes = await fetch('/api/import/youtube', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, forceType: confirmedType, userLanguage: storedLang || 'en' }),
        });
        const data = await extractRes.json();
        if (!extractRes.ok) throw new Error(data.error || 'Import failed');

        if (confirmedType === 'technique' && !data.videoOnly) {
          const technique = await createTechnique(user.id, {
            ...data.technique,
            source_url: url,
            source_type: 'youtube',
            youtube_video_id: data.videoId ?? null,
            image_url: data.thumbnail ?? null,
          });
          router.push(`/technique/${technique.id}`);
          setLoading(null);
          return;
        } else if (data.videoOnly) {
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
          setLoading(null);
          return;
        } else {
          const recipeData = {
            ...data.recipe,
            source_url: url,
            image_url: data.thumbnail ?? undefined,
            youtube_video_id: data.videoId ?? undefined,
            channel_name: data.channelName ?? undefined,
          };
          const { recipe } = await createRecipeWithModeration(user.id, recipeData);
          router.push(`/recipe/${recipe.id}`);
          setLoading(null);
          return;
        }
      }

      const endpoint = '/api/import/url';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, userLanguage: storedLang || 'en' }),
      });
      const data = await res.json();
      if (!res.ok && res.status !== 206) throw new Error(data.error || 'Import failed');

      if (data.duplicate && data.existingRecipe) {
        const action = await confirm({
          icon: '📖',
          title: 'This recipe is already in ChefsBook',
          body: `"${data.existingRecipe.title}" has already been imported. You can add it to your collection or import a fresh copy.`,
          confirmLabel: 'Add to My Recipes',
          cancelLabel: 'Import anyway',
        });
        if (action) {
          const { data: sess } = await supabase.auth.getSession();
          if (sess.session?.access_token) {
            await saveRecipe(data.existingRecipe.id, user.id);
          }
          router.push(`/recipe/${data.existingRecipe.id}`);
          setLoading(null);
          return;
        }
        const retry = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, userLanguage: storedLang || 'en', skipDuplicateCheck: true }),
        });
        const retryData = await retry.json();
        if (!retry.ok && retry.status !== 206) throw new Error(retryData.error || 'Import failed');
        Object.assign(data, retryData);
      }

      if (data.needsBrowserExtraction) {
        const hasExtension = typeof document !== 'undefined' && document.documentElement.hasAttribute('data-chefsbook-extension');
        if (hasExtension && !data.recipe) {
          window.postMessage({ type: 'CHEFSBOOK_PDF_IMPORT', url }, '*');
          setLoading(null);
          return;
        }
        if (data.incompleteMessage) {
          console.log('Import incomplete — extension could improve:', data.incompleteMessage);
        }
        if (!data.recipe) {
          throw new Error(data.incompleteMessage || data.message || 'This site requires the ChefsBook browser extension for full import.');
        }
      }

      if (data.discovery?.isNew && typeof window !== 'undefined') {
        sessionStorage.setItem('chefsbook_discovery', JSON.stringify(data.discovery));
      }

      if (data.contentType === 'technique' && !data.videoOnly) {
        const technique = await createTechnique(user.id, {
          ...data.technique,
          source_url: url,
          source_type: isYouTubeUrl(url) ? 'youtube' : 'web',
          youtube_video_id: data.videoId ?? null,
          image_url: data.thumbnail ?? data.imageUrl ?? null,
        });
        router.push(`/technique/${technique.id}`);
      } else if (data.videoOnly) {
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

  // ── Method card click handlers ──

  const handleMethodClick = (method: ImportMethod) => {
    setError('');
    if (method === 'scan' || method === 'choose') {
      fileInputRef.current?.click();
    } else if (method === 'manual') {
      router.push('/recipe/new');
    } else {
      setActiveMethod(activeMethod === method ? null : method);
    }
  };

  // ── Bookmark / file handlers ──

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
        const mapped = data.recipes.map((r: any, i: number) => ({
          title: r.title || `Recipe ${i + 1}`,
          url: '',
          folder: r.section_hint || data.fileType || 'Recipes',
          selected: true,
          isDuplicate: false,
          existingTitle: undefined,
          _recipe: r,
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

    const hasDirectRecipes = selected.some((b: any) => b._recipe);

    if (hasDirectRecipes) {
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

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      {/* Hidden file input for image upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleImage(file);
          e.target.value = '';
        }}
      />

      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-cb-text">Add a Recipe</h1>
        <p className="text-cb-secondary text-sm mt-1">Choose how to add your recipe</p>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-cb-primary rounded-input p-3 mb-6 text-sm flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError('')} className="ml-auto shrink-0">
            <X className="w-4 h-4 text-cb-secondary hover:text-cb-text" />
          </button>
        </div>
      )}

      {/* Hero: Speak a Recipe button */}
      <Link
        href="/dashboard/speak"
        className="block w-full bg-cb-primary hover:bg-cb-primary/90 transition-colors rounded-xl p-5 mb-6"
      >
        <div className="flex items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
            <Mic className="w-6 h-6 text-white" />
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="text-white text-lg font-bold">Speak a Recipe</span>
              <span className="bg-white/20 text-white text-[10px] font-semibold px-2 py-0.5 rounded">PRO</span>
            </div>
            <p className="text-white/80 text-sm">Dictate and AI formats it instantly</p>
          </div>
        </div>
      </Link>

      {/* Import method grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        {IMPORT_METHODS.map(({ id, icon: Icon, title, subtitle }) => (
          <button
            key={id}
            onClick={() => handleMethodClick(id)}
            disabled={loading !== null}
            className={`bg-cb-bg border rounded-xl p-4 text-center transition-all hover:shadow-md hover:border-cb-primary/30 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-cb-primary/30 ${
              activeMethod === id ? 'border-cb-primary shadow-md' : 'border-stone-200'
            }`}
          >
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-2">
              <Icon className="w-5 h-5 text-cb-primary" />
            </div>
            <p className="font-semibold text-[15px] text-cb-text">{title}</p>
            <p className="text-cb-muted text-[13px] mt-0.5 line-clamp-1">{subtitle}</p>
          </button>
        ))}
      </div>

      {/* Loading indicator */}
      {loading === 'image' && (
        <div className="bg-cb-card border border-cb-border rounded-card p-6 mb-6 text-center">
          <Spinner className="mx-auto mb-3" />
          <p className="font-medium">Extracting recipe...</p>
          <p className="text-cb-secondary text-sm mt-1">Your Sous Chef is reading your image</p>
        </div>
      )}

      {/* URL import panel */}
      {activeMethod === 'url' && (
        <div className="bg-cb-card border border-cb-border rounded-card p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Import from URL</h3>
            <button onClick={() => setActiveMethod(null)} className="text-cb-secondary hover:text-cb-text">
              <X className="w-5 h-5" />
            </button>
          </div>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/recipe..."
            className="w-full bg-cb-bg border border-cb-border rounded-input px-4 py-3 text-sm placeholder:text-cb-secondary/60 outline-none focus:border-cb-primary transition-colors mb-3"
            onKeyDown={(e) => e.key === 'Enter' && handleUrlImport()}
          />
          <button
            onClick={handleUrlImport}
            disabled={!url.trim() || loading !== null}
            className="w-full bg-cb-green text-white py-3 rounded-input text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading === 'url' ? (
              <><Spinner size={16} /> Your Sous Chef is fetching this recipe...</>
            ) : (
              'Import Recipe'
            )}
          </button>
          <p className="text-xs text-cb-secondary mt-3">
            Works with most recipe websites. We strip the life story and extract just the recipe.
          </p>
        </div>
      )}

      {/* YouTube import panel */}
      {activeMethod === 'youtube' && (
        <div className="bg-cb-card border border-cb-border rounded-card p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Import from YouTube</h3>
            <button onClick={() => setActiveMethod(null)} className="text-cb-secondary hover:text-cb-text">
              <X className="w-5 h-5" />
            </button>
          </div>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://youtube.com/watch?v=..."
            className="w-full bg-cb-bg border border-cb-border rounded-input px-4 py-3 text-sm placeholder:text-cb-secondary/60 outline-none focus:border-cb-primary transition-colors mb-3"
            onKeyDown={(e) => e.key === 'Enter' && handleUrlImport()}
          />
          <button
            onClick={handleUrlImport}
            disabled={!url.trim() || loading !== null}
            className="w-full bg-cb-green text-white py-3 rounded-input text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading === 'url' ? (
              <><Spinner size={16} /> Your Sous Chef is fetching this video...</>
            ) : (
              'Import from YouTube'
            )}
          </button>
          <p className="text-xs text-cb-secondary mt-3">
            YouTube imports include timestamp-linked steps from the video transcript.
          </p>
        </div>
      )}

      {/* Paste text panel */}
      {activeMethod === 'paste' && (
        <div className="bg-cb-card border border-cb-border rounded-card p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Paste Recipe Text</h3>
            <button onClick={() => setActiveMethod(null)} className="text-cb-secondary hover:text-cb-text">
              <X className="w-5 h-5" />
            </button>
          </div>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder="Paste ingredients, steps, or the full recipe. Your Sous Chef will extract and structure it for you."
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
              'Import from text'
            )}
          </button>
        </div>
      )}

      {/* Info banners */}
      <div className="space-y-3 mb-6">
        {/* Instagram/TikTok tip */}
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-card p-4">
          <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
            <Lightbulb className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <p className="text-sm text-cb-text">
              <span className="font-semibold">See a recipe on Instagram or TikTok?</span>{' '}
              Screenshot it and use Scan Photo — we'll read the photo and the caption.
            </p>
          </div>
        </div>

        {/* Chrome extension banner */}
        <div className="flex items-start gap-3 bg-cb-green-soft border border-cb-green/20 rounded-card p-4">
          <div className="w-8 h-8 rounded-full bg-cb-green/10 flex items-center justify-center shrink-0">
            <Globe className="w-4 h-4 text-cb-green" />
          </div>
          <div>
            <p className="text-sm text-cb-text">
              <span className="font-semibold">Import directly from Chrome</span> — Install the ChefsBook extension to save any recipe in one click.
            </p>
          </div>
        </div>
      </div>

      {/* File import section */}
      <div className="bg-cb-card border border-cb-border rounded-card p-5">
        <h3 className="font-semibold mb-1">Import from File</h3>
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
              className={`border-2 border-dashed rounded-card p-8 text-center transition-colors mb-4 ${
                bmDragOver ? 'border-cb-primary bg-cb-primary/5' : 'border-cb-border'
              }`}
            >
              <Folder className="w-10 h-10 text-cb-secondary mx-auto mb-3" />
              <p className="text-cb-secondary text-sm mb-4">
                Drag & drop any file here
                <span className="block text-[10px] mt-1">PDF, Word, HTML, Text, CSV, JSON</span>
              </p>
              <label className="inline-block bg-cb-primary text-white px-6 py-2.5 rounded-input text-sm font-semibold cursor-pointer hover:opacity-90 transition-opacity">
                Choose File
                <input type="file" accept=".html,.htm,.pdf,.docx,.doc,.txt,.rtf,.csv,.json" className="hidden" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleBookmarkFile(file);
                }} />
              </label>
            </div>
          </>
        )}

        {/* Phase: checking */}
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
                  Import {selectedCount} selected
                </button>
              </div>
            </div>

            <div className="max-h-[400px] overflow-y-auto border border-cb-border rounded-card">
              {folders.map((folder) => {
                const folderBms = bookmarks.filter((b) => b.folder === folder);
                const allSelected = folderBms.every((b) => b.selected);
                const noneSelected = folderBms.every((b) => !b.selected);
                const expanded = expandedFolders.has(folder);
                const folderDupes = folderBms.filter((b) => b.isDuplicate).length;

                return (
                  <div key={folder}>
                    <div
                      onClick={() => toggleExpand(folder)}
                      className="flex items-center gap-2 px-3 py-2.5 hover:bg-cb-bg/50 cursor-pointer border-b border-cb-border select-none"
                    >
                      {expanded ? (
                        <ChevronDown className="w-3.5 h-3.5 text-cb-secondary shrink-0" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-cb-secondary shrink-0" />
                      )}

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
                        {allSelected && <Check className="w-2.5 h-2.5" />}
                        {!allSelected && !noneSelected && <span className="w-2 h-0.5 bg-white" />}
                      </button>

                      <Folder className="w-4 h-4 text-cb-secondary shrink-0" />
                      <span className="text-sm font-medium truncate">{folder}</span>

                      <span className="text-xs text-cb-secondary ml-auto shrink-0">
                        {folderBms.filter((b) => b.selected).length}/{folderBms.length}
                      </span>
                      {folderDupes > 0 && (
                        <span className="text-[10px] text-amber-600 shrink-0">
                          {folderDupes} dup{folderDupes !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>

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
                          <span
                            className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                              bm.selected
                                ? 'bg-cb-primary border-cb-primary text-white'
                                : 'border-cb-border'
                            }`}
                          >
                            {bm.selected && <Check className="w-2 h-2" />}
                          </span>

                          {hostname && (
                            <img
                              src={`https://www.google.com/s2/favicons?domain=${hostname}&sz=16`}
                              alt=""
                              className="w-4 h-4 shrink-0"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                          )}

                          <div className="flex-1 min-w-0">
                            <p className={`text-sm truncate ${bm.isDuplicate ? 'text-cb-secondary' : ''}`}>{bm.title}</p>
                            {bm.url && <p className="text-[10px] text-cb-secondary truncate">{bm.url}</p>}
                            {bm.isDuplicate && bm.existingTitle && (
                              <p className="text-[10px] text-amber-600 truncate">Already imported: {bm.existingTitle}</p>
                            )}
                          </div>

                          {bm.isDuplicate && <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

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

        {/* Phase: importing */}
        {bmPhase === 'importing' && (
          <div className="py-8">
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

        {/* Phase: done */}
        {bmPhase === 'done' && (
          <div className="py-8 text-center">
            <div className="w-16 h-16 rounded-full bg-cb-green/10 flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-cb-green" />
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

            {failedCount > 0 && (
              <div className="text-left max-w-lg mx-auto mb-6">
                <button
                  onClick={() => setShowFailed(!showFailed)}
                  className="text-sm text-cb-secondary hover:text-cb-text flex items-center gap-1"
                >
                  {showFailed ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
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
      <AlertDialog />
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
