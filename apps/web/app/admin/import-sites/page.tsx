'use client';

import { useState, useEffect } from 'react';
import { adminFetch, adminPost } from '@/lib/adminFetch';

interface SiteRow {
  id: string;
  domain: string;
  last_import_at: string | null;
  total_attempts: number;
  successful_attempts: number;
  known_issue: string | null;
  status: string;
  created_at: string;
}

type Filter = 'all' | 'working' | 'partial' | 'broken' | 'unknown';

const STATUS_STYLE: Record<string, string> = {
  working: 'bg-green-100 text-green-700',
  partial: 'bg-amber-100 text-amber-700',
  broken: 'bg-red-100 text-red-700',
  unknown: 'bg-gray-100 text-gray-600',
};

export default function ImportSitesPage() {
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [editId, setEditId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState('unknown');
  const [editIssue, setEditIssue] = useState('');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminFetch({ page: 'import-sites' });
      setSites(data.sites ?? []);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = sites.filter((s) => filter === 'all' || s.status === filter);

  const openEdit = (s: SiteRow) => {
    setEditId(s.id);
    setEditStatus(s.status);
    setEditIssue(s.known_issue ?? '');
  };

  const saveEdit = async () => {
    if (!editId) return;
    try {
      await adminPost({ action: 'updateImportSite', siteId: editId, status: editStatus, knownIssue: editIssue || null, markReviewed: true });
      setEditId(null);
      load();
    } catch (e: any) { setError(e.message); }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Import Site Tracker</h1>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3 mb-4">{error}<button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button></div>}

      <div className="flex gap-2 mb-4">
        {(['all', 'working', 'partial', 'broken', 'unknown'] as Filter[]).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize ${filter === f ? 'bg-cb-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {f} ({f === 'all' ? sites.length : sites.filter((s) => s.status === f).length})
          </button>
        ))}
      </div>

      {/* Edit modal */}
      {editId && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
          <h3 className="font-semibold text-gray-900 mb-3">Edit Site</h3>
          <div className="flex gap-3 items-end flex-wrap">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Status</label>
              <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)} className="border border-gray-300 rounded-md px-3 py-2 text-sm">
                <option value="working">Working</option>
                <option value="partial">Partial</option>
                <option value="broken">Broken</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Known Issue</label>
              <input value={editIssue} onChange={(e) => setEditIssue(e.target.value)} placeholder="e.g. Ingredients missing" className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
            </div>
            <button onClick={saveEdit} className="bg-cb-primary text-white px-4 py-2 rounded-md text-sm font-semibold hover:opacity-90">Save</button>
            <button onClick={() => setEditId(null)} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
          </div>
        </div>
      )}

      {loading ? <p className="text-gray-500">Loading...</p> : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Domain</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Success Rate</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Last Import</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Known Issue</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const rate = s.total_attempts > 0 ? Math.round((s.successful_attempts / s.total_attempts) * 100) : 0;
                return (
                  <tr key={s.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{s.domain}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_STYLE[s.status] ?? STATUS_STYLE.unknown}`}>{s.status}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{rate}% ({s.successful_attempts}/{s.total_attempts})</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{s.last_import_at ? new Date(s.last_import_at).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs max-w-[200px] truncate" title={s.known_issue ?? undefined}>{s.known_issue ?? '—'}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => openEdit(s)} className="text-xs px-2 py-1 rounded bg-gray-50 text-gray-700 hover:bg-gray-100">Edit</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <p className="p-8 text-center text-gray-500">No import sites tracked yet.</p>}
        </div>
      )}
    </div>
  );
}
