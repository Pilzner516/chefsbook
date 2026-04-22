'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@chefsbook/db';
import ChefsDialog from '@/components/ChefsDialog';

interface FlagDetail {
  id: string;
  reasons: string[];
  details: string | null;
  created_at: string;
  flagged_by: string | null;
  user_profiles?: { username: string } | null;
}

interface FlaggedRecipe {
  id: string;
  title: string;
  visibility: string;
  moderation_status: string | null;
  image_url: string | null;
  user_id: string;
  user_profiles: { username: string } | null;
  flags: FlagDetail[];
  flag_count: number;
  latest_flag_at: string | null;
}

export default function FlaggedRecipesPage() {
  const [recipes, setRecipes] = useState<FlaggedRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<FlaggedRecipe | null>(null);
  const [acting, setActing] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError('Not authenticated');
        return;
      }

      const res = await fetch('/api/admin/flags', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to load flagged recipes');
      }

      const data = await res.json();
      setRecipes(data.recipes || []);
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleAction = async (recipeId: string, action: string, adminNotes?: string) => {
    setActing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const res = await fetch(`/api/admin/flags/${recipeId}/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action, adminNotes }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Action failed');
      }

      // Success - reload the list
      setSelectedRecipe(null);
      setDeleteConfirm(null);
      await load();
    } catch (e: any) {
      setError(e.message);
    }
    setActing(false);
  };

  const aggregateReasons = (flags: FlagDetail[]): Map<string, number> => {
    const counts = new Map<string, number>();
    flags.forEach((flag) => {
      flag.reasons.forEach((reason) => {
        counts.set(reason, (counts.get(reason) || 0) + 1);
      });
    });
    return counts;
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Flagged Recipes</h1>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : recipes.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <p className="text-gray-500 text-lg">No flagged recipes — the community is behaving! 🎉</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Recipe</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Owner</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Flags</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Reasons</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Latest Flag</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Visibility</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {recipes.map((recipe) => {
                const reasonCounts = aggregateReasons(recipe.flags);
                return (
                  <tr
                    key={recipe.id}
                    className="border-b last:border-0 hover:bg-gray-50 cursor-pointer"
                    onClick={(e) => {
                      // Don't open drawer if clicking action buttons
                      if ((e.target as HTMLElement).closest('button')) return;
                      setSelectedRecipe(recipe);
                    }}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {recipe.image_url && (
                          <img
                            src={recipe.image_url}
                            alt={recipe.title}
                            className="w-12 h-12 object-cover rounded"
                          />
                        )}
                        <Link
                          href={`/recipe/${recipe.id}`}
                          target="_blank"
                          className="text-cb-primary hover:underline font-medium"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {recipe.title}
                        </Link>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {recipe.user_profiles?.username ? (
                        <Link
                          href={`/u/${recipe.user_profiles.username}`}
                          className="text-cb-primary hover:underline text-xs"
                          onClick={(e) => e.stopPropagation()}
                        >
                          @{recipe.user_profiles.username}
                        </Link>
                      ) : (
                        <span className="text-xs text-gray-400">Unknown</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center justify-center w-6 h-6 bg-red-100 text-red-700 rounded-full text-xs font-bold">
                        {recipe.flag_count}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {Array.from(reasonCounts.entries()).map(([reason, count]) => (
                          <span
                            key={reason}
                            className="inline-block px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full text-xs"
                          >
                            {reason} ({count})
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {recipe.latest_flag_at
                        ? new Date(recipe.latest_flag_at).toLocaleDateString()
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          recipe.visibility === 'public'
                            ? 'bg-green-50 text-green-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {recipe.visibility === 'public' ? 'Public' : 'Private'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAction(recipe.id, 'make_private');
                          }}
                          disabled={acting}
                          className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                        >
                          Make Private
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAction(recipe.id, 'hide');
                          }}
                          disabled={acting}
                          className="text-xs px-2 py-1 rounded bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                        >
                          Hide
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirm(recipe.id);
                          }}
                          disabled={acting}
                          className="text-xs px-2 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50"
                        >
                          Delete
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAction(recipe.id, 'dismiss');
                          }}
                          disabled={acting}
                          className="text-xs px-2 py-1 rounded bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-50"
                        >
                          Dismiss
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Flag detail drawer */}
      {selectedRecipe && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-end"
          onClick={() => setSelectedRecipe(null)}
        >
          <div
            className="bg-white w-full max-w-2xl h-full overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-start gap-4">
                {selectedRecipe.image_url && (
                  <img
                    src={selectedRecipe.image_url}
                    alt={selectedRecipe.title}
                    className="w-24 h-24 object-cover rounded"
                  />
                )}
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{selectedRecipe.title}</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    by @{selectedRecipe.user_profiles?.username || 'Unknown'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedRecipe(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900">Flags ({selectedRecipe.flags.length})</h3>
              {selectedRecipe.flags.map((flag) => (
                <div key={flag.id} className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      {flag.flagged_by ? (
                        <p className="text-sm font-medium text-gray-900">
                          @{flag.user_profiles?.username || 'Unknown'}
                        </p>
                      ) : (
                        <p className="text-sm font-medium text-blue-600">AI Proctor</p>
                      )}
                      <p className="text-xs text-gray-500">
                        {new Date(flag.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {flag.reasons.map((reason, i) => (
                      <span
                        key={i}
                        className="inline-block px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full text-xs"
                      >
                        {reason}
                      </span>
                    ))}
                  </div>
                  {flag.details && (
                    <p className="text-sm text-gray-700 mt-2">{flag.details}</p>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-8 flex gap-3">
              <button
                onClick={() => handleAction(selectedRecipe.id, 'make_private')}
                disabled={acting}
                className="flex-1 px-4 py-2 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50 font-medium"
              >
                Make Private
              </button>
              <button
                onClick={() => handleAction(selectedRecipe.id, 'hide')}
                disabled={acting}
                className="flex-1 px-4 py-2 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:opacity-50 font-medium"
              >
                Hide
              </button>
              <button
                onClick={() => setDeleteConfirm(selectedRecipe.id)}
                disabled={acting}
                className="flex-1 px-4 py-2 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50 font-medium"
              >
                Delete
              </button>
              <button
                onClick={() => handleAction(selectedRecipe.id, 'dismiss')}
                disabled={acting}
                className="flex-1 px-4 py-2 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-50 font-medium"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {deleteConfirm && (
        <ChefsDialog
          open={true}
          onClose={() => setDeleteConfirm(null)}
          title="Delete Recipe"
          body="This will permanently delete this recipe. This cannot be undone."
          buttons={[
            {
              label: 'Delete',
              variant: 'primary',
              onClick: () => handleAction(deleteConfirm, 'delete'),
            },
            {
              label: 'Cancel',
              variant: 'cancel',
              onClick: () => setDeleteConfirm(null),
            },
          ]}
        />
      )}
    </div>
  );
}
