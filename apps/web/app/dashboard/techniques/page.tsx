'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase, listTechniques, deleteTechnique } from '@chefsbook/db';
import type { Technique } from '@chefsbook/db';

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: 'bg-green-100 text-green-700',
  intermediate: 'bg-amber-100 text-amber-700',
  advanced: 'bg-red-100 text-red-700',
};

export default function TechniquesPage() {
  const [techniques, setTechniques] = useState<Technique[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadTechniques();
  }, [search]);

  const loadTechniques = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const data = await listTechniques({ userId: user.id, search: search || undefined });
      setTechniques(data);
    }
    setLoading(false);
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Techniques</h1>
        <Link
          href="/dashboard/techniques/new"
          className="bg-purple-600 text-white px-5 py-2.5 rounded-input text-sm font-semibold hover:opacity-90 transition-opacity flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Technique
        </Link>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cb-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search techniques..."
          className="w-full bg-cb-card border border-cb-border rounded-input pl-10 pr-4 py-3 text-sm placeholder:text-cb-secondary/60 outline-none focus:border-purple-500 transition-colors"
        />
      </div>

      {loading ? (
        <div className="text-center text-cb-secondary py-20">Loading techniques...</div>
      ) : techniques.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold mb-2">No techniques yet</h2>
          <p className="text-cb-secondary text-sm mb-6">
            Import a technique from a URL or YouTube video, or add one manually.
          </p>
          <Link
            href="/dashboard/scan"
            className="bg-purple-600 text-white px-6 py-2.5 rounded-input text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Add Your First Technique
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {techniques.map((t) => (
            <Link key={t.id} href={`/technique/${t.id}`} className="group">
              <div className="bg-cb-card border border-cb-border rounded-card overflow-hidden hover:border-purple-400 transition-colors">
                <div className="h-36 bg-cb-bg overflow-hidden flex items-center justify-center relative">
                  {t.image_url ? (
                    <img src={t.image_url} alt={t.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  ) : (
                    <svg className="w-12 h-12 text-purple-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347" />
                    </svg>
                  )}
                  {/* Purple technique badge */}
                  <span className="absolute top-2 left-2 bg-purple-600/90 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
                    Technique
                  </span>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold mb-1.5 group-hover:text-purple-600 transition-colors">{t.title}</h3>
                  <div className="flex items-center gap-2 text-xs text-cb-secondary">
                    {t.difficulty && (
                      <span className={`font-medium px-2 py-0.5 rounded ${DIFFICULTY_COLORS[t.difficulty] ?? ''}`}>
                        {t.difficulty.charAt(0).toUpperCase() + t.difficulty.slice(1)}
                      </span>
                    )}
                    {t.tools_and_equipment.length > 0 && (
                      <span>{t.tools_and_equipment.length} tool{t.tools_and_equipment.length !== 1 ? 's' : ''}</span>
                    )}
                    {((t.process_steps as any[]) ?? []).length > 0 && (
                      <span>{((t.process_steps as any[]) ?? []).length} steps</span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
