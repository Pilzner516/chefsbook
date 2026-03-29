'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, createRecipe } from '@chefsbook/db';
import { scanRecipe } from '@chefsbook/ai';

// ─── Bookmark types ─────────────────────────────────────────────

interface Bookmark {
  title: string;
  url: string;
  folder: string;
  selected: boolean;
}

interface ImportResult {
  title: string;
  url: string;
  folder: string;
  status: 'imported' | 'skipped' | 'failed';
  error?: string;
}

type BookmarkPhase = 'idle' | 'preview' | 'importing' | 'done';

// ─── Folder tag colours ─────────────────────────────────────────

const FOLDER_COLOURS = [
  'bg-red-100 text-red-700',
  'bg-blue-100 text-blue-700',
  'bg-green-100 text-green-700',
  'bg-amber-100 text-amber-700',
  'bg-purple-100 text-purple-700',
  'bg-pink-100 text-pink-700',
  'bg-cyan-100 text-cyan-700',
  'bg-orange-100 text-orange-700',
];

function getFolderColour(folder: string, allFolders: string[]): string {
  const idx = allFolders.indexOf(folder);
  return FOLDER_COLOURS[idx % FOLDER_COLOURS.length]!;
}

// ─── Main page ──────────────────────────────────────────────────

export default function ScanPage() {
  const router = useRouter();

  // Image / URL state
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState<'image' | 'url' | null>(null);
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

  // ── Resume active import on mount ──
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
      const base64 = await fileToBase64(file);
      const scanned = await scanRecipe(base64, file.type || 'image/jpeg');
      const recipe = await createRecipe(user.id, scanned);
      router.push(`/recipe/${recipe.id}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(null);
    }
  };

  const handleUrlImport = async () => {
    if (!url.trim()) return;
    setLoading('url');
    setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');
      const res = await fetch('/api/import/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');
      const recipe = await createRecipe(user.id, { ...data.recipe, source_url: url, image_url: data.imageUrl || undefined });
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
      for (const child of Array.from(node.children)) {
        if (child.tagName === 'DT') {
          const h3 = child.querySelector(':scope > h3');
          const a = child.querySelector(':scope > a');
          const dl = child.querySelector(':scope > dl');

          if (h3 && dl) {
            walk(dl, h3.textContent?.trim() || folder);
          } else if (a) {
            const href = a.getAttribute('href');
            if (href && href.startsWith('http')) {
              results.push({
                title: a.textContent?.trim() || href,
                url: href,
                folder: folder || 'Uncategorised',
                selected: true,
              });
            }
          }
        } else if (child.tagName === 'DL') {
          walk(child, folder);
        }
      }
    };

    const topDl = doc.querySelector('dl');
    if (topDl) walk(topDl, 'Bookmarks');
    return results;
  };

  const handleBookmarkFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const html = reader.result as string;
      const parsed = parseBookmarksHtml(html);
      setBookmarks(parsed);
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

  const selectedCount = bookmarks.filter((b) => b.selected).length;
  const folders = [...new Set(bookmarks.map((b) => b.folder))];

  const startBookmarkImport = async () => {
    const selected = bookmarks.filter((b) => b.selected);
    if (selected.length === 0) return;

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
      <p className="text-cb-muted text-sm mb-8">
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
        <div className="bg-cb-card border border-cb-border rounded-card p-6">
          <h2 className="font-semibold mb-1">Scan from image</h2>
          <p className="text-cb-muted text-sm mb-4">
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
              <div className="text-cb-muted">
                <Spinner className="mx-auto mb-3" />
                <p className="text-sm font-medium">Extracting recipe...</p>
                <p className="text-xs mt-1">Claude is reading your image</p>
              </div>
            ) : (
              <>
                <svg className="w-10 h-10 text-cb-muted mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                </svg>
                <p className="text-cb-muted text-sm mb-4">Drag & drop a recipe image here</p>
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
        <div className="bg-cb-card border border-cb-border rounded-card p-6">
          <h2 className="font-semibold mb-1">Import from URL</h2>
          <p className="text-cb-muted text-sm mb-4">
            Paste a link to any recipe page. We strip the life story and extract just the recipe.
          </p>
          <div className="space-y-4">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/recipe..."
              className="w-full bg-cb-bg border border-cb-border rounded-input px-4 py-3 text-sm placeholder:text-cb-muted/60 outline-none focus:border-cb-primary transition-colors"
            />
            <button
              onClick={handleUrlImport}
              disabled={!url.trim() || loading !== null}
              className="w-full bg-cb-green text-white py-3 rounded-input text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading === 'url' ? (
                <><Spinner size={16} /> Importing...</>
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
            <p className="text-xs text-cb-muted leading-relaxed">
              Works with most recipe websites including AllRecipes, BBC Good Food,
              Serious Eats, NYT Cooking, and many more.
            </p>
          </div>
        </div>
      </div>

      {/* Third panel: Bookmark import */}
      <div className="bg-cb-card border border-cb-border rounded-card p-6">
        <h2 className="font-semibold mb-1">Import bookmarks folder</h2>
        <p className="text-cb-muted text-sm mb-4">
          Bulk-import recipe URLs from your browser bookmarks. Export your bookmarks as HTML first.
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
              <svg className="w-10 h-10 text-cb-muted mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" />
              </svg>
              <p className="text-cb-muted text-sm mb-4">
                Drag & drop your <span className="font-mono text-xs bg-cb-bg px-1.5 py-0.5 rounded">bookmarks.html</span> file here
              </p>
              <label className="inline-block bg-cb-primary text-white px-6 py-2.5 rounded-input text-sm font-semibold cursor-pointer hover:opacity-90 transition-opacity">
                Choose File
                <input type="file" accept=".html,.htm" className="hidden" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleBookmarkFile(file);
                }} />
              </label>
            </div>

            <div className="bg-cb-bg rounded-input p-4">
              <p className="text-xs font-semibold text-cb-muted mb-2">How to export bookmarks:</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-cb-muted">
                <div>
                  <p className="font-medium text-cb-text mb-0.5">Chrome</p>
                  <p>Bookmarks Manager &rarr; &#8942; &rarr; Export bookmarks</p>
                </div>
                <div>
                  <p className="font-medium text-cb-text mb-0.5">Safari</p>
                  <p>File &rarr; Export Bookmarks...</p>
                </div>
                <div>
                  <p className="font-medium text-cb-text mb-0.5">Firefox</p>
                  <p>Bookmarks &rarr; Manage &rarr; Import and Backup &rarr; Export</p>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Phase: preview — table grouped by folder */}
        {bmPhase === 'preview' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm">
                <span className="font-semibold">{bookmarks.length}</span> bookmarks found in{' '}
                <span className="font-semibold">{folders.length}</span> folders
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { setBmPhase('idle'); setBookmarks([]); }}
                  className="text-sm text-cb-muted hover:text-cb-text"
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

            <div className="max-h-[500px] overflow-y-auto border border-cb-border rounded-card">
              {folders.map((folder) => {
                const folderBookmarks = bookmarks.filter((b) => b.folder === folder);
                const allSelected = folderBookmarks.every((b) => b.selected);
                const noneSelected = folderBookmarks.every((b) => !b.selected);
                const colour = getFolderColour(folder, folders);

                return (
                  <div key={folder} className="border-b border-cb-border last:border-b-0">
                    {/* Folder header */}
                    <div className="flex items-center gap-3 px-4 py-3 bg-cb-bg sticky top-0">
                      <button
                        onClick={() => toggleFolder(folder, !allSelected)}
                        className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                          allSelected
                            ? 'bg-cb-primary border-cb-primary text-white'
                            : noneSelected
                            ? 'border-cb-border'
                            : 'bg-cb-primary/50 border-cb-primary/50 text-white'
                        }`}
                      >
                        {(allSelected || !noneSelected) && (
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                          </svg>
                        )}
                      </button>
                      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${colour}`}>
                        {folder}
                      </span>
                      <span className="text-xs text-cb-muted ml-auto">
                        {folderBookmarks.filter((b) => b.selected).length} / {folderBookmarks.length}
                      </span>
                      <button
                        onClick={() => toggleFolder(folder, true)}
                        className="text-[10px] text-cb-primary hover:underline"
                      >
                        All
                      </button>
                      <button
                        onClick={() => toggleFolder(folder, false)}
                        className="text-[10px] text-cb-muted hover:underline"
                      >
                        None
                      </button>
                    </div>

                    {/* Bookmark rows */}
                    {folderBookmarks.map((bm) => {
                      const globalIndex = bookmarks.indexOf(bm);
                      const hostname = (() => { try { return new URL(bm.url).hostname; } catch { return ''; } })();

                      return (
                        <div
                          key={globalIndex}
                          onClick={() => toggleBookmark(globalIndex)}
                          className="flex items-center gap-3 px-4 py-2 hover:bg-cb-bg/50 cursor-pointer transition-colors"
                        >
                          <span
                            className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                              bm.selected
                                ? 'bg-cb-primary border-cb-primary text-white'
                                : 'border-cb-border'
                            }`}
                          >
                            {bm.selected && (
                              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                              </svg>
                            )}
                          </span>
                          {/* favicon */}
                          <img
                            src={`https://www.google.com/s2/favicons?domain=${hostname}&sz=16`}
                            alt=""
                            className="w-4 h-4 shrink-0"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm truncate">{bm.title}</p>
                            <p className="text-[10px] text-cb-muted truncate">{bm.url}</p>
                          </div>
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${colour}`}>
                            {folder}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
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
                <p className="text-xs text-cb-muted">
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
              className="mt-4 text-sm text-cb-muted hover:text-cb-primary"
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
            <p className="text-cb-muted mb-6">
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
                  className="text-sm text-cb-muted hover:text-cb-text flex items-center gap-1"
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
                className="border border-cb-border px-6 py-2.5 rounded-input text-sm font-medium text-cb-muted hover:text-cb-text transition-colors"
              >
                Import more
              </button>
            </div>
          </div>
        )}
      </div>
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
