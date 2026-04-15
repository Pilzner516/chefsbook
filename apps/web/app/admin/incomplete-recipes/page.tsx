'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminFetch, adminPost } from '@/lib/adminFetch';

interface IncompleteRecipe {
  id: string;
  title: string;
  user_id: string;
  missing_fields: string[] | null;
  ai_recipe_verdict: 'approved' | 'flagged' | 'not_a_recipe' | 'pending' | null;
  ai_verdict_reason: string | null;
  source_url: string | null;
  source_type: string | null;
  is_complete: boolean;
  created_at: string;
  owner: { id: string; username: string | null; display_name: string | null } | null;
}

export default function IncompleteRecipesPage() {
  const [recipes, setRecipes] = useState<IncompleteRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await adminFetch({ page: 'incomplete-recipes' });
      setRecipes(data.recipes ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'failed');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const forceApprove = async (id: string) => {
    try {
      await adminPost({ action: 'forceApproveRecipe', recipeId: id });
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'failed');
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Remove this recipe? This cannot be undone.')) return;
    try {
      await adminPost({ action: 'deleteRecipe', recipeId: id });
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'failed');
    }
  };

  const verdictStyle = (v: string | null) => {
    if (v === 'flagged') return 'bg-amber-100 text-amber-700';
    if (v === 'not_a_recipe') return 'bg-red-100 text-red-700';
    if (v === 'approved') return 'bg-green-100 text-green-700';
    return 'bg-gray-100 text-gray-600';
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Incomplete Recipes</h1>
      <p className="text-sm text-gray-600 mb-4">
        Recipes that failed the completeness gate or AI verdict. They are kept private until resolved.
      </p>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3 mb-4">{error}</div>}
      {loading ? <p className="text-gray-500">Loading...</p> : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-3 py-3 text-left font-medium text-gray-500">Title</th>
                <th className="px-3 py-3 text-left font-medium text-gray-500">Owner</th>
                <th className="px-3 py-3 text-left font-medium text-gray-500">Missing</th>
                <th className="px-3 py-3 text-left font-medium text-gray-500">AI Verdict</th>
                <th className="px-3 py-3 text-left font-medium text-gray-500">Source</th>
                <th className="px-3 py-3 text-left font-medium text-gray-500">Imported</th>
                <th className="px-3 py-3 text-left font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {recipes.map((r) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-3 py-3">
                    <Link href={`/recipe/${r.id}`} className="font-medium text-gray-900 hover:underline">{r.title}</Link>
                  </td>
                  <td className="px-3 py-3">
                    {r.owner ? (
                      <Link href={`/dashboard/chef/${r.owner.username ?? r.owner.id}`} className="text-cb-primary hover:underline">
                        @{r.owner.username ?? r.owner.display_name ?? 'user'}
                      </Link>
                    ) : '—'}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(r.missing_fields ?? []).map((f) => (
                        <span key={f} className="bg-amber-50 text-amber-700 text-xs px-2 py-0.5 rounded-full">{f}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    {r.ai_recipe_verdict && (
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium capitalize ${verdictStyle(r.ai_recipe_verdict)}`}>
                        {r.ai_recipe_verdict.replace(/_/g, ' ')}
                      </span>
                    )}
                    {r.ai_verdict_reason && <div className="text-xs text-gray-500 mt-1">{r.ai_verdict_reason}</div>}
                  </td>
                  <td className="px-3 py-3 text-xs text-gray-600">
                    {r.source_url ? (() => {
                      try { return new URL(r.source_url).hostname.replace(/^www\./, ''); } catch { return r.source_type ?? '—'; }
                    })() : r.source_type ?? '—'}
                  </td>
                  <td className="px-3 py-3 text-xs text-gray-500">{new Date(r.created_at).toLocaleDateString()}</td>
                  <td className="px-3 py-3 flex gap-2">
                    <Link href={`/recipe/${r.id}`} className="text-xs px-2 py-1 rounded bg-gray-50 text-gray-700 hover:bg-gray-100">View</Link>
                    <button onClick={() => forceApprove(r.id)} className="text-xs px-2 py-1 rounded bg-green-50 text-green-700 hover:bg-green-100">Approve</button>
                    <button onClick={() => remove(r.id)} className="text-xs px-2 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100">Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {recipes.length === 0 && <p className="p-8 text-center text-gray-500">No incomplete recipes 🎉</p>}
        </div>
      )}
    </div>
  );
}
