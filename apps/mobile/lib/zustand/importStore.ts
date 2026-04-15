import { create } from 'zustand';
import { importFromUrl } from '@chefsbook/ai';
import { createRecipe } from '@chefsbook/db';
import type { RecipeWithDetails } from '@chefsbook/db';

export interface ImportJob {
  id: string;
  urls: string[];
  folder: string | null;
  completed: number;
  failed: number;
  total: number;
  status: 'running' | 'done' | 'error';
  results: { url: string; recipeId?: string; error?: string }[];
}

interface ImportState {
  currentJob: ImportJob | null;
  dismissBanner: () => void;
  importUrls: (userId: string, urls: string[], folder?: string) => Promise<void>;
}

let jobCounter = 0;

export const useImportStore = create<ImportState>((set, get) => ({
  currentJob: null,

  dismissBanner: () => set({ currentJob: null }),

  importUrls: async (userId, urls, folder) => {
    const validUrls = urls.filter((u) => u.trim()).map((u) => u.trim());
    if (validUrls.length === 0) return;

    const jobId = `import_${++jobCounter}_${Date.now()}`;
    const job: ImportJob = {
      id: jobId,
      urls: validUrls,
      folder: folder ?? null,
      completed: 0,
      failed: 0,
      total: validUrls.length,
      status: 'running',
      results: [],
    };
    set({ currentJob: job });

    for (const url of validUrls) {
      try {
        const res = await fetch(url);
        const html = await res.text();
        const scanned = await importFromUrl(html, url);
        const recipe = await createRecipe(userId, {
          ...scanned,
          source_url: url,
          source_type: 'url',
          tags: folder ? [folder] : [],
        } as any);
        try {
          fetch('https://chefsbk.app/api/recipes/finalize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recipeId: recipe.id, userId, url, source: 'url' }),
          }).catch(() => {});
        } catch {}
        set((s) => {
          if (!s.currentJob || s.currentJob.id !== jobId) return s;
          const completed = s.currentJob.completed + 1;
          return {
            currentJob: {
              ...s.currentJob,
              completed,
              results: [...s.currentJob.results, { url, recipeId: recipe.id }],
              status: completed + s.currentJob.failed === s.currentJob.total ? 'done' : 'running',
            },
          };
        });
      } catch (e: any) {
        set((s) => {
          if (!s.currentJob || s.currentJob.id !== jobId) return s;
          const failed = s.currentJob.failed + 1;
          return {
            currentJob: {
              ...s.currentJob,
              failed,
              results: [...s.currentJob.results, { url, error: e.message }],
              status: s.currentJob.completed + failed === s.currentJob.total ? 'done' : 'running',
            },
          };
        });
      }
    }
  },
}));
