'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { adminFetch, adminPost } from '@/lib/adminFetch';

interface FlaggedRecipe {
  id: string;
  title: string;
  user_id: string;
  original_submitter_username: string | null;
  moderation_status: string;
  moderation_flag_reason: string | null;
  moderation_flagged_at: string | null;
  visibility: string;
  created_at: string;
}

interface RecipeRow {
  id: string;
  title: string;
  user_id: string;
  original_submitter_username: string | null;
  visibility: string;
  source_type: string;
  moderation_status: string | null;
  created_at: string;
}

type SortKey = 'title' | 'submitter' | 'visibility' | 'moderation_status' | 'created_at';
type SortDir = 'asc' | 'desc';

export default function RecipeModerationPage() {
  const [flagged, setFlagged] = useState<FlaggedRecipe[]>([]);
  const [recipes, setRecipes] = useState<RecipeRow[]>([]);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminFetch({ page: 'recipes', search });
      setFlagged((data.flagged ?? []) as FlaggedRecipe[]);
      setRecipes((data.recipes ?? []) as RecipeRow[]);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);
  useEffect(() => { loadAll(); }, [search]);

  const sortedRecipes = useMemo(() => {
    const list = [...recipes];
    const dir = sortDir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      switch (sortKey) {
        case 'title': return dir * a.title.localeCompare(b.title);
        case 'submitter': return dir * (a.original_submitter_username ?? '').localeCompare(b.original_submitter_username ?? '');
        case 'visibility': return dir * a.visibility.localeCompare(b.visibility);
        case 'moderation_status': return dir * (a.moderation_status ?? '').localeCompare(b.moderation_status ?? '');
        case 'created_at': return dir * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        default: return 0;
      }
    });
    return list;
  }, [recipes, sortKey, sortDir]);

  const handleApprove = async (r: FlaggedRecipe) => {
    setActing(r.id);
    try { await adminPost({ action: 'approveRecipe', recipeId: r.id }); } catch {}
    setActing(null);
    loadAll();
  };

  const handleReject = async (r: FlaggedRecipe) => {
    setActing(r.id);
    try { await adminPost({ action: 'rejectRecipe', recipeId: r.id }); } catch {}
    setActing(null);
    loadAll();
  };

  const hideRecipe = async (id: string) => {
    try { await adminPost({ action: 'hideRecipe', recipeId: id }); } catch {}
    loadAll();
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Recipe Moderation</h1>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3 mb-4">{error}</div>}

      {/* Flagged recipes queue */}
      {flagged.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">
            Flagged Recipes <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full ml-2">{flagged.length}</span>
          </h2>
          <div className="space-y-3">
            {flagged.map((r) => (
              <div key={r.id} className={`bg-white rounded-lg border p-4 ${r.moderation_status === 'flagged_serious' ? 'border-red-300 bg-red-50' : 'border-amber-300 bg-amber-50'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${r.moderation_status === 'flagged_serious' ? 'bg-red-200 text-red-800' : 'bg-amber-200 text-amber-800'}`}>
                        {r.moderation_status === 'flagged_serious' ? 'AUTO-HIDDEN — SERIOUS' : 'FLAGGED — MILD'}
                      </span>
                    </div>
                    <Link href={`/recipe/${r.id}`} className="font-semibold text-gray-900 hover:underline text-sm">
                      {r.title}
                    </Link>
                    {r.moderation_flag_reason && (
                      <p className="text-xs text-gray-600 mt-1">Reason: {r.moderation_flag_reason}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      Flagged {r.moderation_flagged_at ? new Date(r.moderation_flagged_at).toLocaleString() : ''}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleApprove(r)}
                      disabled={acting === r.id}
                      className="text-xs px-3 py-1.5 rounded bg-green-100 text-green-800 hover:bg-green-200 disabled:opacity-50 font-medium"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleReject(r)}
                      disabled={acting === r.id}
                      className="text-xs px-3 py-1.5 rounded bg-red-100 text-red-800 hover:bg-red-200 disabled:opacity-50 font-medium"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Public recipes list */}
      <h2 className="text-lg font-semibold text-gray-800 mb-3">All Recipes</h2>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search recipes..."
        className="w-full max-w-md border border-gray-300 rounded-md px-3 py-2 text-sm mb-4"
      />

      {loading ? <p className="text-gray-500">Loading...</p> : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {([['title','Title'],['submitter','Submitter'],['visibility','Visibility'],['moderation_status','Status'],['created_at','Date Added']] as [SortKey,string][]).map(([key, label]) => (
                  <th key={key} onClick={() => { if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortKey(key); setSortDir('asc'); } }} className="px-4 py-3 text-left font-medium text-gray-500 cursor-pointer hover:text-gray-700 select-none">
                    {label}{sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                  </th>
                ))}
                <th className="px-4 py-3 text-left font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedRecipes.map((r) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    <Link href={`/recipe/${r.id}`} className="hover:underline">{r.title}</Link>
                  </td>
                  <td className="px-4 py-3">
                    {r.original_submitter_username ? (
                      <Link href={`/u/${r.original_submitter_username}`} className="inline-block bg-cb-primary/10 text-cb-primary text-xs px-2 py-0.5 rounded-full font-medium hover:bg-cb-primary/20">@{r.original_submitter_username}</Link>
                    ) : <span className="text-xs text-gray-400">Unknown</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs capitalize">{r.visibility}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{r.moderation_status ?? 'clean'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{new Date(r.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => hideRecipe(r.id)} className="text-xs px-2 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100">
                      Hide
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {recipes.length === 0 && <p className="p-8 text-center text-gray-500">No public recipes found.</p>}
        </div>
      )}
    </div>
  );
}
