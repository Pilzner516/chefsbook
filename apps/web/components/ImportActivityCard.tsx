'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@chefsbook/db';
import Link from 'next/link';

interface Stats { imported: number; withIssues: number; flagged: number; sitesDiscovered?: number; }
interface IncompleteRecipe { id: string; title: string; missing_fields: string[]; created_at: string; }

export default function ImportActivityCard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [incomplete, setIncomplete] = useState<IncompleteRecipe[]>([]);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const token = data.session?.access_token;
      if (!token) return;
      try {
        const res = await fetch('/api/user/import-stats', { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return;
        const body = await res.json();
        setStats(body.stats);
        setIncomplete(body.incomplete ?? []);
      } catch {}
    });
  }, []);

  if (!stats) return null;

  return (
    <div className="bg-white border border-cb-border rounded-card p-4 mt-4">
      <h3 className="font-semibold text-cb-text mb-2">Your Import Activity</h3>
      <div className="flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2">📥 {stats.imported} recipes imported</div>
        <div className="flex items-center gap-2">
          ⚠️ {stats.withIssues} had import issues
          {stats.withIssues > 0 && (
            <button onClick={() => setModalOpen(true)} className="text-xs text-cb-primary underline">View</button>
          )}
        </div>
        <div className="flex items-center gap-2">🚩 {stats.flagged} flagged</div>
        {!!stats.sitesDiscovered && stats.sitesDiscovered > 0 && (
          <div
            className="flex items-center gap-2 text-cb-green"
            title="Sites you were the first ChefsBook user to import from"
          >
            🌍 {stats.sitesDiscovered} site{stats.sitesDiscovered === 1 ? '' : 's'} you helped discover
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setModalOpen(false)}>
          <div className="bg-white rounded-card max-w-lg w-full p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-cb-text mb-3">Recipes with import issues</h3>
            {incomplete.length === 0 ? (
              <p className="text-sm text-cb-secondary">None 🎉</p>
            ) : (
              <ul className="space-y-2 max-h-[60vh] overflow-y-auto">
                {incomplete.map((r) => (
                  <li key={r.id} className="border border-cb-border rounded-md p-2">
                    <Link href={`/recipe/${r.id}`} className="font-medium text-cb-text hover:underline">{r.title}</Link>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {r.missing_fields.map((f) => (
                        <span key={f} className="bg-amber-50 text-amber-700 text-xs px-2 py-0.5 rounded-full">{f}</span>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <button onClick={() => setModalOpen(false)} className="mt-3 text-sm text-cb-secondary">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
