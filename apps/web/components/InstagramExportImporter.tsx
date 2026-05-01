'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, PLAN_LIMITS, checkRecipeLimit } from '@chefsbook/db';
import { Camera, Upload, X, Check, ChevronRight, AlertTriangle, ExternalLink } from 'lucide-react';
import JSZip from 'jszip';

// ── Types ──────────────────────────────────────────────────────────

interface InstagramPost {
  uri: string;
  imageBase64: string;
  caption: string;
  timestamp: number;
}

interface ClassifiedPost {
  uri: string;
  isFood: boolean;
  imageBase64: string;
  caption: string;
  timestamp: number;
  extracted: {
    title: string | null;
    cuisine: string | null;
    tags: string[];
    notes: string | null;
  } | null;
}

interface InstagramExportImporterProps {
  planTier: string;
}

const BATCH_SIZE = 20;
const MAX_FOOD_POSTS = 500;

export default function InstagramExportImporter({ planTier }: InstagramExportImporterProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<'upload' | 'processing' | 'review' | 'saving' | 'generating' | 'done'>('upload');
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const [zipFile, setZipFile] = useState<File | null>(null);

  // Processing state
  const [allPosts, setAllPosts] = useState<InstagramPost[]>([]);
  const [foodPosts, setFoodPosts] = useState<ClassifiedPost[]>([]);
  const [scannedCount, setScannedCount] = useState(0);
  const [cancelled, setCancelled] = useState(false);
  const cancelledRef = useRef(false);

  // Review state
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editedTitles, setEditedTitles] = useState<Record<string, string>>({});
  const [recipeLimit, setRecipeLimit] = useState<number | null>(null);
  const [currentRecipeCount, setCurrentRecipeCount] = useState<number>(0);

  // Save state
  const [saveProgress, setSaveProgress] = useState(0);
  const [saveTotal, setSaveTotal] = useState(0);
  const [saved, setSaved] = useState(0);
  const [skipped, setSkipped] = useState(0);
  const [savedRecipeIds, setSavedRecipeIds] = useState<string[]>([]);

  // Generation state
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationTotal, setGenerationTotal] = useState(0);
  const [generationCompleted, setGenerationCompleted] = useState<Array<{ recipeId: string; title: string; ingredientCount: number; stepCount: number }>>([]);
  const [generationFailed, setGenerationFailed] = useState<Array<{ recipeId: string; error: string }>>([]);

  // Check plan limits on mount
  useEffect(() => {
    async function checkLimits() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const gate = await checkRecipeLimit(user.id);
        if (typeof gate.limit === 'number') {
          setRecipeLimit(gate.limit);
          setCurrentRecipeCount(gate.current ?? 0);
        }
      }
    }
    checkLimits();
  }, []);

  // Parse ZIP file
  const parseZip = useCallback(async (file: File): Promise<InstagramPost[]> => {
    const zip = await JSZip.loadAsync(file);
    const posts: InstagramPost[] = [];

    // Find all posts_*.json files
    const postFiles = Object.keys(zip.files).filter(
      (name) => name.includes('posts_') && name.endsWith('.json')
    );

    for (const postFile of postFiles) {
      try {
        const content = await zip.files[postFile].async('string');
        const data = JSON.parse(content);

        if (Array.isArray(data)) {
          for (const post of data) {
            const media = post?.media?.[0];
            if (!media?.uri) continue;

            const imageFile = zip.files[media.uri];
            if (!imageFile) continue;

            try {
              const imageBlob = await imageFile.async('base64');
              posts.push({
                uri: media.uri,
                imageBase64: imageBlob,
                caption: media.title || '',
                timestamp: media.creation_timestamp || 0,
              });
            } catch {
              // Skip posts with unreadable images
            }
          }
        }
      } catch {
        // Skip malformed JSON files
      }
    }

    // Sort by timestamp descending (most recent first)
    posts.sort((a, b) => b.timestamp - a.timestamp);
    return posts;
  }, []);

  // Start classification
  const startClassification = useCallback(async () => {
    if (!zipFile) return;
    setPhase('processing');
    setError('');
    setCancelled(false);
    cancelledRef.current = false;
    setFoodPosts([]);
    setScannedCount(0);

    try {
      const posts = await parseZip(zipFile);
      setAllPosts(posts);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not signed in');
      }

      const foundFood: ClassifiedPost[] = [];

      for (let i = 0; i < posts.length; i += BATCH_SIZE) {
        if (cancelledRef.current) break;
        if (foundFood.length >= MAX_FOOD_POSTS) break;

        const batch = posts.slice(i, i + BATCH_SIZE);

        try {
          const res = await fetch('/api/import/instagram-export/classify', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              batch: batch.map((p) => ({
                uri: p.uri,
                imageBase64: p.imageBase64,
                caption: p.caption,
                timestamp: p.timestamp,
              })),
            }),
          });

          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Classification failed');
          }

          const { results } = await res.json();

          for (const result of results) {
            if (result.isFood && foundFood.length < MAX_FOOD_POSTS) {
              const originalPost = batch.find((p) => p.uri === result.uri);
              if (originalPost) {
                foundFood.push({
                  ...originalPost,
                  isFood: true,
                  extracted: result.extracted,
                });
              }
            }
          }

          setFoodPosts([...foundFood]);
          setScannedCount(Math.min(i + batch.length, posts.length));
        } catch (batchError) {
          console.error('Batch error:', batchError);
          // Continue with next batch
        }
      }

      if (foundFood.length > 0) {
        setFoodPosts(foundFood);
        setSelected(new Set(foundFood.map((p) => p.uri)));
        setPhase('review');
      } else if (!cancelledRef.current) {
        setError('No food photos found in this export. Make sure you exported your Instagram data correctly.');
        setPhase('upload');
      }
    } catch (e: any) {
      setError(e.message);
      setPhase('upload');
    }
  }, [zipFile, parseZip]);

  // Cancel processing
  const handleCancel = useCallback(() => {
    setCancelled(true);
    cancelledRef.current = true;
    setPhase('upload');
    setZipFile(null);
  }, []);

  // Toggle selection
  const toggleSelect = useCallback((uri: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(uri)) {
        next.delete(uri);
      } else {
        // Check if adding would exceed limit
        if (recipeLimit !== null && currentRecipeCount + next.size >= recipeLimit) {
          return prev;
        }
        next.add(uri);
      }
      return next;
    });
  }, [recipeLimit, currentRecipeCount]);

  const selectAll = useCallback(() => {
    const maxSelectable = recipeLimit !== null
      ? Math.min(foodPosts.length, recipeLimit - currentRecipeCount)
      : foodPosts.length;
    setSelected(new Set(foodPosts.slice(0, maxSelectable).map((p) => p.uri)));
  }, [foodPosts, recipeLimit, currentRecipeCount]);

  const deselectAll = useCallback(() => {
    setSelected(new Set());
  }, []);

  // Save selected posts
  const saveSelected = useCallback(async () => {
    const toSave = foodPosts.filter((p) => selected.has(p.uri));
    if (toSave.length === 0) return;

    setPhase('saving');
    setSaveProgress(0);
    setSaveTotal(toSave.length);
    setSaved(0);
    setSkipped(0);
    setSavedRecipeIds([]);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      setError('Not signed in');
      setPhase('review');
      return;
    }

    try {
      const res = await fetch('/api/import/instagram-export/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          posts: toSave.map((p) => ({
            uri: p.uri,
            imageBase64: p.imageBase64,
            extracted: {
              ...p.extracted,
              title: editedTitles[p.uri] ?? p.extracted?.title,
            },
            timestamp: p.timestamp,
          })),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Save failed');
      }

      setSaveProgress(toSave.length);
      setSaved(data.saved);
      setSkipped(data.skipped);
      const recipeIds = data.recipeIds || [];
      setSavedRecipeIds(recipeIds);

      if (recipeIds.length > 0) {
        setPhase('generating');
        await completeRecipes(recipeIds, session.access_token);
      } else {
        setPhase('done');
      }
    } catch (e: any) {
      setError(e.message);
      setPhase('review');
    }
  }, [foodPosts, selected, editedTitles]);

  const completeRecipes = useCallback(async (recipeIds: string[], accessToken: string) => {
    setGenerationProgress(0);
    setGenerationTotal(recipeIds.length);
    setGenerationCompleted([]);
    setGenerationFailed([]);

    const BATCH_SIZE = 5;
    const allCompleted: Array<{ recipeId: string; title: string; ingredientCount: number; stepCount: number }> = [];
    const allFailed: Array<{ recipeId: string; error: string }> = [];

    for (let i = 0; i < recipeIds.length; i += BATCH_SIZE) {
      const batch = recipeIds.slice(i, i + BATCH_SIZE);

      try {
        const res = await fetch('/api/import/instagram-export/complete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ recipeIds: batch }),
        });

        const data = await res.json();

        if (res.ok) {
          if (data.completed) allCompleted.push(...data.completed);
          if (data.failed) allFailed.push(...data.failed);
        } else {
          batch.forEach((id) => allFailed.push({ recipeId: id, error: data.error || 'Request failed' }));
        }
      } catch (batchError: any) {
        batch.forEach((id) => allFailed.push({ recipeId: id, error: batchError.message || 'Network error' }));
      }

      setGenerationProgress(Math.min(i + batch.length, recipeIds.length));
      setGenerationCompleted([...allCompleted]);
      setGenerationFailed([...allFailed]);
    }

    setPhase('done');
  }, []);

  // Plan gate: Pro only
  if (planTier !== 'pro') {
    return (
      <div className="bg-cb-card border border-cb-border rounded-card p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <Camera className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-cb-text">Import from Instagram Export</h3>
            <p className="text-cb-secondary text-sm">Pro plan feature</p>
          </div>
        </div>
        <p className="text-sm text-cb-secondary mb-4">
          Upload your Instagram data export ZIP to automatically import all your food photos as recipe stubs.
        </p>
        <button
          onClick={() => router.push('/dashboard/plans')}
          className="w-full bg-cb-primary text-white py-3 rounded-input text-sm font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
        >
          Upgrade to Pro
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // Phase: Upload
  if (phase === 'upload') {
    return (
      <div className="bg-cb-card border border-cb-border rounded-card p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <Camera className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-cb-text">Import from Instagram Export</h3>
            <p className="text-cb-secondary text-sm">Upload your Instagram data ZIP</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-cb-primary rounded-input p-3 mb-4 text-sm flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
            <button onClick={() => setError('')} className="ml-auto shrink-0">
              <X className="w-4 h-4 text-cb-secondary hover:text-cb-text" />
            </button>
          </div>
        )}

        <div
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files[0];
            if (file?.name.endsWith('.zip')) {
              setZipFile(file);
            } else {
              setError('Please upload a ZIP file');
            }
          }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          className={`border-2 border-dashed rounded-card p-8 text-center transition-colors mb-4 ${
            dragOver ? 'border-cb-primary bg-cb-primary/5' : 'border-cb-border'
          }`}
        >
          <Upload className="w-10 h-10 text-cb-secondary mx-auto mb-3" />
          {zipFile ? (
            <div className="flex items-center justify-center gap-2 mb-3">
              <Check className="w-5 h-5 text-cb-green" />
              <span className="font-medium text-cb-text">{zipFile.name}</span>
              <button onClick={() => setZipFile(null)} className="text-cb-secondary hover:text-cb-text">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <p className="text-cb-secondary text-sm mb-4">
              Drag & drop your Instagram export ZIP here
            </p>
          )}
          <label className="inline-block bg-cb-bg border border-cb-border px-6 py-2.5 rounded-input text-sm font-medium cursor-pointer hover:bg-cb-border/30 transition-colors">
            {zipFile ? 'Choose Different File' : 'Choose ZIP File'}
            <input
              type="file"
              accept=".zip"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file?.name.endsWith('.zip')) {
                  setZipFile(file);
                } else if (file) {
                  setError('Please upload a ZIP file');
                }
              }}
            />
          </label>
        </div>

        <button
          onClick={startClassification}
          disabled={!zipFile}
          className="w-full bg-cb-green text-white py-3 rounded-input text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 mb-4"
        >
          Start Import
        </button>

        <a
          href="https://www.instagram.com/download/request/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1 text-sm text-cb-secondary hover:text-cb-primary"
        >
          How to export your Instagram data
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    );
  }

  // Phase: Processing
  if (phase === 'processing') {
    return (
      <div className="bg-cb-card border border-cb-border rounded-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-cb-text">Scanning your photos...</h3>
          <button onClick={handleCancel} className="text-cb-secondary hover:text-cb-text text-sm">
            Cancel
          </button>
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium">
              Scanning {scannedCount} / {allPosts.length} posts...
            </p>
            <p className="text-xs text-cb-secondary">
              {allPosts.length > 0 ? Math.round((scannedCount / allPosts.length) * 100) : 0}%
            </p>
          </div>
          <div className="w-full h-2 bg-cb-bg rounded-full overflow-hidden">
            <div
              className="h-full bg-cb-primary rounded-full transition-all duration-300"
              style={{ width: `${allPosts.length > 0 ? (scannedCount / allPosts.length) * 100 : 0}%` }}
            />
          </div>
        </div>

        <p className="text-sm text-cb-green font-medium text-center">
          Found {foodPosts.length} food photo{foodPosts.length !== 1 ? 's' : ''} so far
        </p>

        {foodPosts.length >= MAX_FOOD_POSTS && (
          <div className="bg-amber-50 border border-amber-200 rounded-input p-3 mt-4 text-sm text-amber-700">
            We found 500+ food posts — showing the most recent 500. Your most recent posts are imported first.
          </div>
        )}
      </div>
    );
  }

  // Phase: Review
  if (phase === 'review') {
    const canSelect = recipeLimit === null || currentRecipeCount + selected.size < recipeLimit;
    const limitMessage = recipeLimit !== null
      ? `You can import ${Math.max(0, recipeLimit - currentRecipeCount - selected.size)} more recipe${recipeLimit - currentRecipeCount - selected.size !== 1 ? 's' : ''} on your plan`
      : null;

    return (
      <div className="bg-cb-card border border-cb-border rounded-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-cb-text">Found {foodPosts.length} food photos</h3>
            <p className="text-cb-secondary text-sm">Select which to import</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={selectAll} className="text-sm text-cb-primary hover:underline">
              Select all
            </button>
            <span className="text-cb-border">|</span>
            <button onClick={deselectAll} className="text-sm text-cb-secondary hover:text-cb-text">
              Deselect all
            </button>
          </div>
        </div>

        {limitMessage && (
          <div className="bg-amber-50 border border-amber-200 rounded-input p-3 mb-4 text-sm text-amber-700">
            {limitMessage}
          </div>
        )}

        <div className="grid grid-cols-3 gap-3 max-h-[400px] overflow-y-auto mb-4">
          {foodPosts.map((post) => {
            const isSelected = selected.has(post.uri);
            const canToggle = isSelected || canSelect;
            const title = editedTitles[post.uri] ?? post.extracted?.title ?? '';

            return (
              <div
                key={post.uri}
                className={`relative rounded-lg overflow-hidden border-2 transition-colors ${
                  isSelected ? 'border-cb-primary' : 'border-transparent'
                } ${!canToggle ? 'opacity-50' : ''}`}
              >
                <img
                  src={`data:image/jpeg;base64,${post.imageBase64}`}
                  alt=""
                  className="w-full aspect-square object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-2">
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setEditedTitles((prev) => ({ ...prev, [post.uri]: e.target.value }))}
                    placeholder="Recipe title..."
                    className="w-full bg-white/90 text-xs px-2 py-1 rounded text-cb-text placeholder:text-cb-secondary outline-none"
                  />
                </div>
                <button
                  onClick={() => canToggle && toggleSelect(post.uri)}
                  disabled={!canToggle}
                  className={`absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                    isSelected
                      ? 'bg-cb-primary text-white'
                      : 'bg-white/80 text-cb-secondary hover:bg-white'
                  }`}
                >
                  {isSelected && <Check className="w-4 h-4" />}
                </button>
              </div>
            );
          })}
        </div>

        <button
          onClick={saveSelected}
          disabled={selected.size === 0}
          className="w-full bg-cb-green text-white py-3 rounded-input text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          Import {selected.size} recipe{selected.size !== 1 ? 's' : ''}
        </button>
      </div>
    );
  }

  // Phase: Saving
  if (phase === 'saving') {
    return (
      <div className="bg-cb-card border border-cb-border rounded-card p-5 text-center">
        <Spinner className="mx-auto mb-4" />
        <h3 className="font-semibold text-cb-text mb-2">Saving your recipes...</h3>
        <p className="text-cb-secondary text-sm mb-3">Step 1 of 2</p>
        <div className="w-full h-2 bg-cb-bg rounded-full overflow-hidden">
          <div
            className="h-full bg-cb-primary rounded-full transition-all duration-300"
            style={{ width: `${saveTotal > 0 ? (saveProgress / saveTotal) * 100 : 0}%` }}
          />
        </div>
      </div>
    );
  }

  // Phase: Generating
  if (phase === 'generating') {
    return (
      <div className="bg-cb-card border border-cb-border rounded-card p-5">
        <div className="text-center mb-4">
          <Spinner className="mx-auto mb-4" />
          <h3 className="font-semibold text-cb-text mb-2">Generating ingredients & steps...</h3>
          <p className="text-cb-secondary text-sm mb-3">Step 2 of 2</p>
          <div className="flex items-center justify-center gap-2 mb-3">
            <p className="text-sm font-medium">
              {generationProgress} / {generationTotal} recipes
            </p>
            <p className="text-xs text-cb-secondary">
              {generationTotal > 0 ? Math.round((generationProgress / generationTotal) * 100) : 0}%
            </p>
          </div>
          <div className="w-full h-2 bg-cb-bg rounded-full overflow-hidden">
            <div
              className="h-full bg-cb-green rounded-full transition-all duration-300"
              style={{ width: `${generationTotal > 0 ? (generationProgress / generationTotal) * 100 : 0}%` }}
            />
          </div>
        </div>

        {generationCompleted.length > 0 && (
          <div className="mt-4 max-h-[200px] overflow-y-auto">
            {generationCompleted.map((item) => (
              <div key={item.recipeId} className="flex items-center gap-2 py-1.5 text-sm">
                <Check className="w-4 h-4 text-cb-green shrink-0" />
                <span className="truncate text-cb-text">{item.title}</span>
                <span className="text-cb-secondary text-xs shrink-0">
                  {item.ingredientCount} ingredients, {item.stepCount} steps
                </span>
              </div>
            ))}
          </div>
        )}

        {generationFailed.length > 0 && (
          <div className="mt-4 max-h-[100px] overflow-y-auto">
            {generationFailed.map((item) => (
              <div key={item.recipeId} className="flex items-center gap-2 py-1.5 text-sm">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="text-cb-secondary text-xs truncate">{item.error}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Phase: Done
  if (phase === 'done') {
    const completedCount = generationCompleted.length;
    const failedCount = generationFailed.length;
    const allGenerated = completedCount === saved && failedCount === 0;

    return (
      <div className="bg-cb-card border border-cb-border rounded-card p-5 text-center">
        <div className="w-16 h-16 rounded-full bg-cb-green/10 flex items-center justify-center mx-auto mb-4">
          <Check className="w-8 h-8 text-cb-green" />
        </div>
        <h3 className="text-xl font-bold mb-2">Import complete!</h3>
        <p className="text-cb-secondary mb-4">
          <span className="font-semibold text-cb-green">{saved} imported</span>
          {skipped > 0 && (
            <> · <span className="font-semibold text-amber-600">{skipped} skipped</span> (duplicates)</>
          )}
        </p>

        {completedCount > 0 && (
          <p className="text-sm text-cb-green mb-2">
            <Check className="w-4 h-4 inline mr-1" />
            {completedCount} recipe{completedCount !== 1 ? 's' : ''} generated with ingredients & steps
          </p>
        )}

        {failedCount > 0 && (
          <p className="text-sm text-amber-600 mb-4">
            <AlertTriangle className="w-4 h-4 inline mr-1" />
            {failedCount} recipe{failedCount !== 1 ? 's' : ''} need manual completion with Sous Chef
          </p>
        )}

        {!allGenerated && failedCount > 0 && (
          <p className="text-sm text-cb-secondary mb-6">
            Some recipes couldn't be auto-completed. Open them and use the Sous Chef to fill in the details.
          </p>
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
              setPhase('upload');
              setZipFile(null);
              setFoodPosts([]);
              setSelected(new Set());
              setEditedTitles({});
              setGenerationCompleted([]);
              setGenerationFailed([]);
            }}
            className="border border-cb-border px-6 py-2.5 rounded-input text-sm font-medium text-cb-secondary hover:text-cb-text transition-colors"
          >
            Import more
          </button>
        </div>
      </div>
    );
  }

  return null;
}

function Spinner({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`animate-spin text-cb-primary ${className}`}
      width={32}
      height={32}
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
