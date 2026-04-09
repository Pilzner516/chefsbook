'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@chefsbook/db';
import Link from 'next/link';

interface RecipeRow {
  id: string;
  title: string;
  user_id: string;
  visibility: string;
  source_type: string;
  created_at: string;
}

export default function RecipeModerationPage() {
  const [recipes, setRecipes] = useState<RecipeRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    let q = supabase.from('recipes').select('id, title, user_id, visibility, source_type, created_at')
      .eq('visibility', 'public')
      .is('parent_recipe_id', null)
      .order('created_at', { ascending: false })
      .limit(50);
    if (search.trim()) q = q.ilike('title', `%${search}%`);
    const { data } = await q;
    setRecipes((data ?? []) as RecipeRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [search]);

  const hideRecipe = async (id: string) => {
    await supabase.from('recipes').update({ visibility: 'private' }).eq('id', id);
    load();
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Recipe Moderation</h1>

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
                <th className="px-4 py-3 text-left font-medium text-gray-500">Title</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Source</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Created</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {recipes.map((r) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    <Link href={`/recipe/${r.id}`} className="hover:underline">{r.title}</Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{r.source_type}</td>
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
