'use client';

import { useState, useEffect, useMemo } from 'react';
import { adminFetch, adminPost } from '@/lib/adminFetch';
import { supabase } from '@chefsbook/db';

interface SiteRow {
  id: string;
  domain: string;
  last_import_at: string | null;
  last_auto_tested_at: string | null;
  total_attempts: number;
  successful_attempts: number;
  known_issue: string | null;
  status: string;
  rating: number | null;
  is_blocked: boolean;
  block_reason: string | null;
  auto_test_enabled: boolean;
  failure_taxonomy: Record<string, number> | null;
  sample_failing_urls: string[] | null;
  notes: string | null;
  created_at: string;
  is_user_discovered?: boolean;
  discovery_count?: number;
  first_discovered_at?: string | null;
  review_status?: 'pending' | 'reviewed' | 'added_to_list' | 'ignored' | null;
}

interface Kpi {
  totalAttempts: number;
  successRate: number;
  lowRating: number;
  blocked: number;
  flagged: number;
  pendingDiscoveries?: number;
}

interface ScheduledJob {
  job_name: string;
  is_enabled: boolean;
  last_run_at: string | null;
  last_run_result: { tested: number; passed: number; failed: number } | null;
}

type Filter = 'all' | 'working' | 'partial' | 'broken' | 'unknown' | 'blocked' | 'discoveries';

const STATUS_STYLE: Record<string, string> = {
  working: 'bg-green-100 text-green-700',
  partial: 'bg-amber-100 text-amber-700',
  broken: 'bg-red-100 text-red-700',
  unknown: 'bg-gray-100 text-gray-600',
};

function Stars({ value, onChange, successRate }: { value: number | null; onChange?: (v: number) => void; successRate?: number | null }) {
  if (value === null || value === undefined) {
    return <span className="text-xs text-gray-400">— Untested</span>;
  }
  return (
    <span className="inline-flex items-center gap-1">
      <span className="inline-flex gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange?.(n)}
            className={`text-base ${n <= value ? 'text-amber-500' : 'text-gray-300'} ${onChange ? 'cursor-pointer hover:text-amber-600' : 'cursor-default'}`}
            aria-label={`${n} stars`}
          >
            ★
          </button>
        ))}
      </span>
      {successRate !== null && successRate !== undefined && (
        <span className="text-xs text-gray-500 ml-0.5">{successRate}%</span>
      )}
    </span>
  );
}

export default function ImportSitesPage() {
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [kpi, setKpi] = useState<Kpi | null>(null);
  const [schedule, setSchedule] = useState<ScheduledJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [testFilters, setTestFilters] = useState<Set<number | null>>(new Set([null, 1, 2]));

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminFetch({ page: 'import-sites' });
      setSites(data.sites ?? []);
      setKpi(data.kpi ?? null);
      setSchedule(data.schedule ?? null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'failed');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = sites.filter((s) =>
    filter === 'all' ? true
    : filter === 'blocked' ? s.is_blocked
    : filter === 'discoveries' ? !!s.is_user_discovered && s.review_status === 'pending'
    : s.status === filter
  );

  const update = async (id: string, patch: Record<string, unknown>) => {
    try {
      await adminPost({ action: 'updateImportSite', siteId: id, ...patch, markReviewed: true });
      load();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'failed'); }
  };

  const exportCsv = () => {
    const header = [
      'domain', 'status', 'rating', 'blocked', 'block_reason', 'success_rate',
      'total_attempts', 'last_tested', 'title_found', 'description_found',
      'ingredients_count', 'ingredients_with_qty', 'steps_count',
      'http_status', 'fetch_method', 'sample_url', 'notes',
    ];
    const rows = sites.map((s) => {
      const t: any = s.failure_taxonomy ?? {};
      return [
        s.domain,
        s.status,
        s.rating ?? '',
        s.is_blocked ? 'yes' : 'no',
        (s.block_reason ?? '').replace(/,/g, ';'),
        s.total_attempts ? Math.round((s.successful_attempts / s.total_attempts) * 100) + '%' : '',
        s.total_attempts,
        s.last_auto_tested_at ?? '',
        t.title ? 'yes' : 'no',
        t.description ? 'yes' : 'no',
        t.ingredients_count ?? '',
        t.ingredients_with_qty ?? '',
        t.steps_count ?? '',
        t.http_status ?? '',
        t.fetch_method ?? '',
        (s.sample_failing_urls?.[0] ?? '').replace(/,/g, ';'),
        (s.notes ?? '').replace(/,/g, ';'),
      ];
    });
    const csv = [header, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `import-sites-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const runTests = async (domain?: string, ratings?: (number | null)[]) => {
    setTesting(true);
    setShowTestModal(false);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const payload: any = {};
      if (domain) payload.domains = [domain];
      else if (ratings) payload.ratings = ratings;
      const res = await fetch('/api/admin/test-sites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Test run failed');
      await load();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'failed'); }
    setTesting(false);
  };

  const selectedTestCount = useMemo(() => {
    if (testFilters.has(-1)) return sites.length; // -1 = "All"
    return sites.filter((s) => testFilters.has(s.rating)).length;
  }, [sites, testFilters]);

  const toggleTestFilter = (value: number | null) => {
    setTestFilters((prev) => {
      const next = new Set(prev);
      if (value === -1) {
        // "All" — exclusive toggle
        return new Set([-1]);
      }
      next.delete(-1); // deselect "All" when picking specific
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  const toggleSchedule = async (enabled: boolean) => {
    await adminPost({ action: 'toggleScheduledJob', jobName: 'site_compatibility_test', enabled });
    load();
  };

  const recalculateRatings = async () => {
    setRecalculating(true);
    try {
      await adminPost({ action: 'recalculateRatings' });
      await load();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'failed'); }
    setRecalculating(false);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Import Site Tracker</h1>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3 mb-4">{error}<button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button></div>}

      {kpi && (
        <div className="grid grid-cols-5 gap-3 mb-4">
          <div className="bg-white border border-gray-200 rounded-lg p-3"><div className="text-xs text-gray-500">Attempts (30d)</div><div className="text-2xl font-bold">{kpi.totalAttempts}</div></div>
          <div className="bg-white border border-gray-200 rounded-lg p-3"><div className="text-xs text-gray-500">Success Rate</div><div className="text-2xl font-bold">{kpi.successRate}%</div></div>
          <div className="bg-white border border-gray-200 rounded-lg p-3"><div className="text-xs text-gray-500">Low Rating (≤2)</div><div className="text-2xl font-bold text-amber-600">{kpi.lowRating}</div></div>
          <div className="bg-white border border-gray-200 rounded-lg p-3"><div className="text-xs text-gray-500">Blocked Sites</div><div className="text-2xl font-bold text-red-600">{kpi.blocked}</div></div>
          <div className="bg-white border border-gray-200 rounded-lg p-3"><div className="text-xs text-gray-500">Incomplete Recipes (30d)</div><div className="text-2xl font-bold text-amber-600">{kpi.flagged}</div></div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">Site Compatibility Testing</h3>
            <p className="text-xs text-gray-500">
              {schedule?.last_run_at
                ? `Last run: ${new Date(schedule.last_run_at).toLocaleString()} — ${schedule.last_run_result?.tested ?? 0} tested, ${schedule.last_run_result?.passed ?? 0} passed, ${schedule.last_run_result?.failed ?? 0} flagged`
                : 'Never run'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={schedule?.is_enabled ?? false} onChange={(e) => toggleSchedule(e.target.checked)} />
              Weekly auto-test
            </label>
            <button
              onClick={() => { setTestFilters(new Set([null, 1, 2])); setShowTestModal(true); }}
              disabled={testing}
              className="bg-cb-primary text-white text-sm font-semibold px-3 py-1.5 rounded-md hover:opacity-90 disabled:opacity-50"
            >
              {testing ? 'Testing...' : 'Run tests...'}
            </button>
            <button onClick={recalculateRatings} disabled={recalculating} className="text-sm text-gray-700 border border-gray-300 rounded-md px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50">{recalculating ? 'Recalculating...' : 'Recalculate Ratings'}</button>
            <button onClick={exportCsv} className="text-sm text-gray-700 border border-gray-300 rounded-md px-3 py-1.5 hover:bg-gray-50">Export CSV</button>
          </div>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        {(['all', 'working', 'partial', 'broken', 'unknown', 'blocked', 'discoveries'] as Filter[]).map((f) => {
          const count =
            f === 'all' ? sites.length
            : f === 'blocked' ? sites.filter((s) => s.is_blocked).length
            : f === 'discoveries' ? sites.filter((s) => s.is_user_discovered && s.review_status === 'pending').length
            : sites.filter((s) => s.status === f).length;
          const isDiscovery = f === 'discoveries';
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize ${
                filter === f
                  ? 'bg-cb-primary text-white'
                  : isDiscovery && count > 0
                    ? 'bg-cb-green-soft text-cb-green hover:bg-cb-green/20'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {isDiscovery ? '🌍 Discoveries' : f} ({count})
            </button>
          );
        })}
      </div>

      {showTestModal && (() => {
        const timeSeconds = selectedTestCount * 8;
        const timeMin = Math.ceil(timeSeconds / 60);
        const PILLS: { label: string; value: number | null }[] = [
          { label: 'All sites', value: -1 },
          { label: 'Untested', value: null },
          { label: '★ 1 star', value: 1 },
          { label: '★★ 2 star', value: 2 },
          { label: '★★★ 3 star', value: 3 },
          { label: '★★★★ 4 star', value: 4 },
          { label: '★★★★★ 5 star', value: 5 },
        ];
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowTestModal(false)}>
            <div className="bg-white rounded-xl shadow-lg w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-lg font-bold text-gray-900 mb-4">Run Site Compatibility Tests</h2>
              <p className="text-sm text-gray-600 mb-3">Select which sites to test:</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {PILLS.map((pill) => {
                  const active = testFilters.has(pill.value as any);
                  const count = pill.value === -1
                    ? sites.length
                    : sites.filter((s) => s.rating === pill.value).length;
                  return (
                    <button
                      key={String(pill.value)}
                      onClick={() => toggleTestFilter(pill.value)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                        active
                          ? 'bg-cb-primary text-white'
                          : 'bg-cb-base text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {pill.label} ({count})
                    </button>
                  );
                })}
              </div>
              <p className="text-sm font-medium text-gray-900 mb-1">{selectedTestCount} site{selectedTestCount !== 1 ? 's' : ''} selected</p>
              <p className="text-xs text-cb-green mb-5">
                Tests run at 1 per 8 seconds. {selectedTestCount} site{selectedTestCount !== 1 ? 's' : ''} will take ~{timeMin} minute{timeMin !== 1 ? 's' : ''}.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowTestModal(false)}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (testFilters.has(-1)) runTests();
                    else runTests(undefined, [...testFilters] as (number | null)[]);
                  }}
                  disabled={selectedTestCount === 0}
                  className="px-4 py-2 text-sm font-semibold text-white bg-cb-primary rounded-md hover:opacity-90 disabled:opacity-50"
                >
                  Run tests on {selectedTestCount} site{selectedTestCount !== 1 ? 's' : ''} &rarr;
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {loading ? <p className="text-gray-500">Loading...</p> : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-3 py-3 text-left font-medium text-gray-500">Domain</th>
                <th className="px-3 py-3 text-left font-medium text-gray-500">Status</th>
                <th className="px-3 py-3 text-left font-medium text-gray-500">Rating</th>
                <th className="px-3 py-3 text-left font-medium text-gray-500">Success</th>
                <th className="px-3 py-3 text-left font-medium text-gray-500">Last Tested</th>
                <th className="px-3 py-3 text-left font-medium text-gray-500">Blocked</th>
                <th className="px-3 py-3 text-left font-medium text-gray-500">Auto</th>
                <th className="px-3 py-3 text-left font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const rate = s.total_attempts > 0 ? Math.round((s.successful_attempts / s.total_attempts) * 100) : 0;
                const isOpen = expanded === s.id;
                return (
                  <>
                    <tr key={s.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-3 py-3 font-medium text-gray-900">
                        <a href={`https://${s.domain}`} target="_blank" rel="noopener noreferrer" className="hover:text-cb-primary hover:underline">
                          {s.domain}
                        </a>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_STYLE[s.status] ?? STATUS_STYLE.unknown}`}>{s.status}</span>
                      </td>
                      <td className="px-3 py-3"><Stars value={s.rating} onChange={(v) => update(s.id, { rating: v })} successRate={s.total_attempts > 0 ? Math.round((s.successful_attempts / s.total_attempts) * 100) : null} /></td>
                      <td className="px-3 py-3 text-gray-600 text-xs">{rate}% ({s.successful_attempts}/{s.total_attempts})</td>
                      <td className="px-3 py-3 text-gray-500 text-xs">{s.last_auto_tested_at ? new Date(s.last_auto_tested_at).toLocaleDateString() : '—'}</td>
                      <td className="px-3 py-3">
                        <label className="inline-flex items-center gap-1 text-xs cursor-pointer">
                          <input type="checkbox" checked={s.is_blocked} onChange={(e) => update(s.id, { isBlocked: e.target.checked })} />
                        </label>
                      </td>
                      <td className="px-3 py-3">
                        <input type="checkbox" checked={s.auto_test_enabled} onChange={(e) => update(s.id, { autoTestEnabled: e.target.checked })} />
                      </td>
                      <td className="px-3 py-3 flex gap-2">
                        <button onClick={() => runTests(s.domain)} disabled={testing} className="text-xs px-2 py-1 rounded bg-gray-50 text-gray-700 hover:bg-gray-100 disabled:opacity-50">Test</button>
                        <button onClick={() => setExpanded(isOpen ? null : s.id)} className="text-xs px-2 py-1 rounded bg-gray-50 text-gray-700 hover:bg-gray-100">{isOpen ? 'Close' : 'Edit'}</button>
                        {s.is_user_discovered && s.review_status === 'pending' && (
                          <>
                            <button onClick={() => update(s.id, { reviewStatus: 'added_to_list' })} title={`Discovered ${s.discovery_count ?? 1}×`} className="text-xs px-2 py-1 rounded bg-cb-green-soft text-cb-green hover:bg-cb-green/20">Add</button>
                            <button onClick={() => update(s.id, { reviewStatus: 'ignored' })} className="text-xs px-2 py-1 rounded bg-gray-50 text-gray-500 hover:bg-gray-100">Ignore</button>
                          </>
                        )}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-gray-50">
                        <td colSpan={8} className="px-3 py-3">
                          <div className="flex flex-wrap gap-3 items-start">
                            {s.is_blocked && (
                              <div className="flex-1 min-w-[250px]">
                                <label className="block text-xs text-gray-500 mb-1">Block reason</label>
                                <input defaultValue={s.block_reason ?? ''} onBlur={(e) => update(s.id, { blockReason: e.target.value })} placeholder="Why is this site blocked?" className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm" />
                              </div>
                            )}
                            <div className="flex-1 min-w-[250px]">
                              <label className="block text-xs text-gray-500 mb-1">Notes</label>
                              <input defaultValue={s.notes ?? ''} onBlur={(e) => update(s.id, { notes: e.target.value })} className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm" />
                            </div>
                            {s.failure_taxonomy && Object.keys(s.failure_taxonomy).length > 0 && (() => {
                              const t: any = s.failure_taxonomy;
                              const hasSessionData = 'ingredients_count' in t || 'fetch_method' in t;
                              if (!hasSessionData) {
                                return (
                                  <div className="w-full">
                                    <div className="text-xs text-gray-500 mb-1">Failure taxonomy</div>
                                    <div className="flex flex-wrap gap-2">
                                      {Object.entries(s.failure_taxonomy).map(([k, v]) => (
                                        <span key={k} className="bg-red-50 text-red-700 text-xs px-2 py-0.5 rounded-full">{k}: {String(v)}</span>
                                      ))}
                                    </div>
                                  </div>
                                );
                              }
                              return (
                                <div className="w-full">
                                  <div className="text-xs text-gray-500 mb-1">What was found</div>
                                  <div className="flex flex-wrap gap-2 text-xs">
                                    <span className={`px-2 py-0.5 rounded-full ${t.title ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>title {t.title ? '✓' : '✗'}</span>
                                    <span className={`px-2 py-0.5 rounded-full ${t.description ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>description {t.description ? '✓' : '✗'}</span>
                                    <span className={`px-2 py-0.5 rounded-full ${(t.ingredients_count ?? 0) > 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{t.ingredients_count ?? 0} ingredients ({t.ingredients_with_qty ?? 0} w/ qty)</span>
                                    <span className={`px-2 py-0.5 rounded-full ${(t.steps_count ?? 0) > 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{t.steps_count ?? 0} steps</span>
                                    {t.http_status != null && (
                                      <span className={`px-2 py-0.5 rounded-full ${t.http_status === 200 ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>HTTP {t.http_status}</span>
                                    )}
                                    {t.fetch_method && (
                                      <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">via {t.fetch_method}</span>
                                    )}
                                  </div>
                                </div>
                              );
                            })()}
                            {s.sample_failing_urls && s.sample_failing_urls.length > 0 && (
                              <div className="w-full">
                                <div className="text-xs text-gray-500 mb-1">Sample failing URLs</div>
                                <ul className="text-xs text-gray-700 space-y-0.5">
                                  {s.sample_failing_urls.map((u) => <li key={u} className="truncate max-w-xl"><a href={u} target="_blank" rel="noopener noreferrer" className="underline">{u}</a></li>)}
                                </ul>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
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
