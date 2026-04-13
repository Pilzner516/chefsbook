'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { adminFetch, adminPost } from '@/lib/adminFetch';
import { useConfirmDialog } from '@/components/useConfirmDialog';

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
type SearchMode = 'title' | 'username';

export default function RecipeModerationPage() {
  const [flagged, setFlagged] = useState<FlaggedRecipe[]>([]);
  const [recipes, setRecipes] = useState<RecipeRow[]>([]);
  const [search, setSearch] = useState('');
  const [searchMode, setSearchMode] = useState<SearchMode>('title');
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [confirmAction, ConfirmDialog] = useConfirmDialog();

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      // Server-side search is by title only; username search is client-side
      const serverSearch = searchMode === 'title' ? search : '';
      const data = await adminFetch({ page: 'recipes', search: serverSearch });
      setFlagged((data.flagged ?? []) as FlaggedRecipe[]);
      setRecipes((data.recipes ?? []) as RecipeRow[]);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);
  useEffect(() => { if (searchMode === 'title') loadAll(); }, [search, searchMode]);

  const filteredRecipes = useMemo(() => {
    let list = [...recipes];
    if (searchMode === 'username' && search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((r) => (r.original_submitter_username ?? '').toLowerCase().includes(q));
    }
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
  }, [recipes, sortKey, sortDir, search, searchMode]);

  const handleApprove = async (r: FlaggedRecipe) => {
    const isSerious = r.moderation_status === 'flagged_serious';
    const ok = await confirmAction({
      icon: '✅',
      title: 'Approve this recipe?',
      body: isSerious
        ? 'This will restore the recipe to public, mark it as clean, and unfreeze the user\'s account.'
        : 'This will mark the recipe as clean and keep it public.',
      confirmLabel: 'Approve',
    });
    if (!ok) return;
    setActing(r.id);
    try {
      await adminPost({
        action: 'approveRecipe',
        recipeId: r.id,
        ownerId: r.user_id,
        unfreezeUserId: isSerious ? r.user_id : undefined,
      });
    } catch {}
    setActing(null);
    loadAll();
  };

  const handleReject = async (r: FlaggedRecipe) => {
    const ok = await confirmAction({
      icon: '🚫',
      title: 'Reject this recipe?',
      body: 'This will set the recipe to private and notify the owner.',
      confirmLabel: 'Reject',
    });
    if (!ok) return;
    setActing(r.id);
    try {
      await adminPost({ action: 'rejectRecipe', recipeId: r.id, ownerId: r.user_id });
    } catch {}
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
                    {r.original_submitter_username && (
                      <span className="ml-2 text-xs text-gray-500">by <Link href={`/u/${r.original_submitter_username}`} className="text-cb-primary hover:underline">@{r.original_submitter_username}</Link></span>
                    )}
                    {r.moderation_flag_reason && (
                      <p className="text-xs text-gray-600 mt-1">Reason: {r.moderation_flag_reason}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      Flagged {r.moderation_flagged_at ? new Date(r.moderation_flagged_at).toLocaleString() : ''}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => handleApprove(r)} disabled={acting === r.id} className="text-xs px-3 py-1.5 rounded bg-green-100 text-green-800 hover:bg-green-200 disabled:opacity-50 font-medium">Approve</button>
                    <button onClick={() => handleReject(r)} disabled={acting === r.id} className="text-xs px-3 py-1.5 rounded bg-red-100 text-red-800 hover:bg-red-200 disabled:opacity-50 font-medium">Reject</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All recipes list */}
      <h2 className="text-lg font-semibold text-gray-800 mb-3">All Recipes</h2>

      {/* Search with mode toggle */}
      <div className="flex gap-2 mb-4 items-center">
        <div className="relative">
          <select value={searchMode} onChange={(e) => { setSearchMode(e.target.value as SearchMode); setSearch(''); }} className="border border-gray-300 rounded-l-md px-3 py-2 text-sm bg-gray-50 pr-8 appearance-none">
            <option value="title">Title</option>
            <option value="username">Username</option>
          </select>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={searchMode === 'title' ? 'Search by title...' : 'Search by username...'}
          className="flex-1 max-w-md border border-l-0 border-gray-300 rounded-r-md px-3 py-2 text-sm"
        />
      </div>

      {loading ? <p className="text-gray-500">Loading...</p> : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {([['title','Title'],['submitter','Submitter'],['visibility','Visibility'],['moderation_status','Status'],['created_at','Date Added']] as [SortKey,string][]).map(([key, label]) => (
                  <th key={key} onClick={() => { if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortKey(key); setSortDir('asc'); } }} className="px-4 py-3 text-left font-medium text-gray-500 cursor-pointer hover:text-gray-700 select-none">
                    {label}
                    {key === 'moderation_status' && (
                      <span className="relative inline-block ml-1">
                        <button onClick={(e) => { e.stopPropagation(); setShowTooltip(!showTooltip); }} className="text-gray-400 hover:text-gray-600">&#9432;</button>
                        {showTooltip && (
                          <div className="absolute z-50 left-0 top-6 bg-white border border-gray-200 rounded-lg shadow-lg p-3 w-64 text-left font-normal" onClick={(e) => e.stopPropagation()}>
                            <p className="text-xs text-gray-700 mb-1"><strong>clean</strong> — AI reviewed, no issues. Fully visible.</p>
                            <p className="text-xs text-gray-700 mb-1"><strong>mild</strong> — Minor concern. Visible but flagged for review.</p>
                            <p className="text-xs text-gray-700 mb-1"><strong>serious</strong> — Serious violation. Auto-hidden + user frozen.</p>
                            <button onClick={() => setShowTooltip(false)} className="text-xs text-gray-400 hover:text-gray-600 mt-1">Close</button>
                          </div>
                        )}
                      </span>
                    )}
                    {sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                  </th>
                ))}
                <th className="px-4 py-3 text-left font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecipes.map((r) => (
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
                    <button onClick={() => hideRecipe(r.id)} className="text-xs px-2 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100">Hide</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredRecipes.length === 0 && <p className="p-8 text-center text-gray-500">No recipes found.</p>}
        </div>
      )}
      <ConfirmDialog />
    </div>
  );
}
