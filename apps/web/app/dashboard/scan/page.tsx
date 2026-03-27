'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, createRecipe } from '@chefsbook/db';
import { scanRecipe, importFromUrl } from '@chefsbook/ai';

export default function ScanPage() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const handleImage = async (file: File) => {
    setLoading(true);
    setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');

      // Resize and convert to base64
      const base64 = await fileToBase64(file);
      const scanned = await scanRecipe(base64, file.type || 'image/jpeg');
      const recipe = await createRecipe(user.id, scanned);
      router.push(`/recipe/${recipe.id}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUrlImport = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');

      const res = await fetch(`/api/import/url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const { html } = await res.json();
      const scanned = await importFromUrl(html, url);
      const recipe = await createRecipe(user.id, { ...scanned, source_url: url });
      router.push(`/recipe/${recipe.id}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith('image/')) handleImage(file);
  }, []);

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-8">Add Recipe</h1>

      {error && (
        <div className="bg-cb-error/10 border border-cb-error/30 text-cb-error rounded-lg p-3 mb-6 text-sm">{error}</div>
      )}

      {/* Image upload */}
      <div
        onDrop={onDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        className={`border-2 border-dashed rounded-xl p-12 text-center mb-8 transition-colors ${
          dragOver ? 'border-cb-primary bg-cb-primary/5' : 'border-cb-border'
        }`}
      >
        <div className="text-4xl mb-4">{'\uD83D\uDCF7'}</div>
        <p className="text-cb-text-secondary mb-4">Drag & drop a recipe image, or</p>
        <label className="inline-block bg-cb-primary text-cb-bg px-6 py-2.5 rounded-lg text-sm font-semibold cursor-pointer hover:opacity-90">
          Choose File
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImage(file);
            }}
          />
        </label>
      </div>

      {/* URL import */}
      <div className="bg-cb-surface border border-cb-border rounded-xl p-6 mb-8">
        <h2 className="font-semibold mb-4">Import from URL</h2>
        <div className="flex gap-3">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/recipe..."
            className="flex-1 bg-cb-bg border border-cb-border rounded-lg px-4 py-2.5 text-sm text-cb-text placeholder:text-cb-text-tertiary outline-none focus:border-cb-primary"
          />
          <button
            onClick={handleUrlImport}
            disabled={!url.trim() || loading}
            className="bg-cb-primary text-cb-bg px-6 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50"
          >
            Import
          </button>
        </div>
      </div>

      {loading && (
        <div className="text-center text-cb-text-secondary py-8">
          <div className="animate-spin text-2xl mb-2">{'\u23F3'}</div>
          Extracting recipe...
        </div>
      )}
    </div>
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
