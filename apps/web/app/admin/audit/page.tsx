'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { adminFetch } from '@/lib/adminFetch';
import { supabase } from '@chefsbook/db';
import { useConfirmDialog } from '@/components/useConfirmDialog';

interface AuditRun {
  id: string;
  run_by_username: string;
  scan_scope: string[];
  scan_mode: string;
  status: string;
  total_items_scanned: number;
  total_flagged: number;
  estimated_cost_usd: number;
  actual_cost_usd: number | null;
  rules_version: string;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
}

interface Finding {
  id: string;
  content_type: string;
  content_preview: string;
  recipe_id: string | null;
  recipe_title: string | null;
  owner_username: string | null;
  finding_severity: string;
  reasons: string[];
  ai_explanation: string;
  action_taken: string;
}

const SCOPE_OPTIONS = [
  { value: 'tags', label: 'Tags' },
  { value: 'recipes', label: 'Recipes' },
  { value: 'comments', label: 'Comments' },
  { value: 'profiles', label: 'Profiles' },
  { value: 'cookbooks', label: 'Cookbooks' },
];

export default function ContentAuditPage() {
  const [scope, setScope] = useState<string[]>(['recipes']);
  const [mode, setMode] = useState<'standard' | 'deep'>('standard');
  const [estimatedCost, setEstimatedCost] = useState(0);
  const [runs, setRuns] = useState<AuditRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<AuditRun | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [selectedFindings, setSelectedFindings] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState('all');
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [filterAction, setFilterAction] = useState('pending');
  const [confirmAction, ConfirmDialog] = useConfirmDialog();

  useEffect(() => {
    loadRuns();
  }, []);

  useEffect(() => {
    if (selectedRun) {
      loadFindings(selectedRun.id);
    }
  }, [selectedRun, filterType, filterSeverity, filterAction]);

  const loadRuns = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const res = await fetch('/api/admin/audit/runs', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      setRuns(data.runs || []);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const loadFindings = async (runId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const params = new URLSearchParams();
      if (filterType !== 'all') params.set('content_type', filterType);
      if (filterSeverity !== 'all') params.set('severity', filterSeverity);
      if (filterAction !== 'all') params.set('action', filterAction);

      const res = await fetch(`/api/admin/audit/runs/${runId}/findings?${params}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      setFindings(data.findings || []);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const runAudit = async () => {
    if (scope.length === 0) {
      setError('Please select at least one scope');
      return;
    }

    if (estimatedCost > 1) {
      const confirmed = await confirmAction({
        icon: '⚠️',
        title: 'High cost warning',
        body: `This scan will cost approximately $${estimatedCost.toFixed(2)}. Continue?`,
        confirmLabel: 'Run Audit',
      });
      if (!confirmed) return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const res = await fetch('/api/admin/audit/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ scope, mode }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      await loadRuns();
      // Poll for completion
      pollRunStatus(data.auditRunId);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const pollRunStatus = async (runId: string) => {
    const interval = setInterval(async () => {
      await loadRuns();
      const run = runs.find(r => r.id === runId);
      if (run && run.status !== 'running') {
        clearInterval(interval);
      }
    }, 3000);
  };

  const handleBatchAction = async (action: string) => {
    if (selectedFindings.size === 0) return;

    if (action === 'delete') {
      const confirmed = await confirmAction({
        icon: '🗑️',
        title: 'Delete permanently?',
        body: `This will permanently delete ${selectedFindings.size} item(s). This cannot be undone.`,
        confirmLabel: 'Delete',
      });
      if (!confirmed) return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const res = await fetch('/api/admin/audit/findings/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          findingIds: Array.from(selectedFindings),
          action,
        }),
      });

      if (!res.ok) throw new Error('Action failed');

      setSelectedFindings(new Set());
      if (selectedRun) loadFindings(selectedRun.id);
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (selectedRun) {
    const pendingCount = findings.filter(f => f.action_taken === 'none').length;

    return (
      <div>
        <div className="mb-4 flex items-center gap-4">
          <button onClick={() => setSelectedRun(null)} className="text-cb-primary hover:underline">
            ← Back to runs
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Audit Results</h1>
        </div>

        {/* Summary bar */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
          <div className="grid grid-cols-5 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-gray-900">{selectedRun.total_items_scanned}</div>
              <div className="text-sm text-gray-500">Items scanned</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">{selectedRun.total_flagged}</div>
              <div className="text-sm text-gray-500">Flagged</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">{selectedRun.total_flagged - pendingCount}</div>
              <div className="text-sm text-gray-500">Actioned</div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-600 capitalize">{selectedRun.scan_mode}</div>
              <div className="text-xs text-gray-500">Scan mode</div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-600">Rules v{selectedRun.rules_version}</div>
              <div className="text-xs text-gray-500">Rules version</div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-4">
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="border border-gray-300 rounded px-3 py-2 text-sm">
            <option value="all">All Types</option>
            <option value="tag">Tags</option>
            <option value="recipe">Recipes</option>
            <option value="comment">Comments</option>
            <option value="profile">Profiles</option>
            <option value="cookbook">Cookbooks</option>
          </select>
          <select value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value)} className="border border-gray-300 rounded px-3 py-2 text-sm">
            <option value="all">All Severities</option>
            <option value="standard">Standard</option>
            <option value="deep_only">Deep Only</option>
          </select>
          <select value={filterAction} onChange={(e) => setFilterAction(e.target.value)} className="border border-gray-300 rounded px-3 py-2 text-sm">
            <option value="all">All Actions</option>
            <option value="pending">Pending</option>
            <option value="actioned">Actioned</option>
          </select>
        </div>

        {/* Batch action bar */}
        {selectedFindings.size > 0 && (
          <div className="bg-cb-primary text-white rounded-lg p-3 mb-4 flex items-center gap-4">
            <span className="font-medium">{selectedFindings.size} selected</span>
            <button onClick={() => handleBatchAction('ignore')} className="px-3 py-1 bg-white/20 rounded hover:bg-white/30 text-sm">Ignore</button>
            <button onClick={() => handleBatchAction('make_private')} className="px-3 py-1 bg-white/20 rounded hover:bg-white/30 text-sm">Make Private</button>
            <button onClick={() => handleBatchAction('hide')} className="px-3 py-1 bg-white/20 rounded hover:bg-white/30 text-sm">Hide</button>
            <button onClick={() => handleBatchAction('flag')} className="px-3 py-1 bg-white/20 rounded hover:bg-white/30 text-sm">Flag</button>
            <button onClick={() => handleBatchAction('delete')} className="px-3 py-1 bg-red-600 rounded hover:bg-red-700 text-sm">Delete</button>
          </div>
        )}

        {/* Results table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">
                  <input type="checkbox" onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedFindings(new Set(findings.map(f => f.id)));
                    } else {
                      setSelectedFindings(new Set());
                    }
                  }} checked={selectedFindings.size === findings.length && findings.length > 0} />
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Type</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Content</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Recipe</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Severity</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Reasons</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Action</th>
              </tr>
            </thead>
            <tbody>
              {findings.map((f) => (
                <tr key={f.id} className={`border-b last:border-0 ${f.finding_severity === 'deep_only' ? 'bg-amber-50' : ''}`}>
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={selectedFindings.has(f.id)} onChange={(e) => {
                      const newSet = new Set(selectedFindings);
                      if (e.target.checked) {
                        newSet.add(f.id);
                      } else {
                        newSet.delete(f.id);
                      }
                      setSelectedFindings(newSet);
                    }} />
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-block bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full capitalize">{f.content_type}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-900 max-w-xs truncate">{f.content_preview}</td>
                  <td className="px-4 py-3">
                    {f.recipe_id && f.recipe_title ? (
                      <Link href={`/recipe/${f.recipe_id}`} className="text-cb-primary hover:underline text-xs">
                        {f.recipe_title}
                      </Link>
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block text-xs px-2 py-0.5 rounded-full ${f.finding_severity === 'deep_only' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                      {f.finding_severity === 'deep_only' ? 'Deep' : 'Standard'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {f.reasons.slice(0, 2).map((r, i) => (
                        <span key={i} className="inline-block bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded">{r}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {f.action_taken === 'none' ? (
                      <span className="text-xs text-gray-500">Pending</span>
                    ) : (
                      <span className="text-xs text-green-600 capitalize">{f.action_taken.replace('_', ' ')}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {findings.length === 0 && <p className="p-8 text-center text-gray-500">No findings match the current filters.</p>}
        </div>

        <ConfirmDialog />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Content Health Audit</h1>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3 mb-4">{error}</div>}

      {/* New audit form */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Run New Audit</h2>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Scan Scope</label>
          <div className="flex flex-wrap gap-2">
            {SCOPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  if (scope.includes(opt.value)) {
                    setScope(scope.filter(s => s !== opt.value));
                  } else {
                    setScope([...scope, opt.value]);
                  }
                }}
                className={`px-4 py-2 rounded-full text-sm font-medium ${scope.includes(opt.value) ? 'bg-cb-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Scan Mode</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input type="radio" checked={mode === 'standard'} onChange={() => setMode('standard')} />
              <span className="text-sm">Standard — catches clear violations</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" checked={mode === 'deep'} onChange={() => setMode('deep')} />
              <span className="text-sm">Deep — catches borderline cases</span>
            </label>
          </div>
        </div>

        <div className="mb-4">
          <div className="text-sm text-gray-600">
            Estimated cost: <span className="font-medium text-gray-900">${estimatedCost.toFixed(4)}</span>
            {estimatedCost > 1 && <span className="ml-2 text-amber-600">⚠️ High cost</span>}
          </div>
        </div>

        <button onClick={runAudit} disabled={loading || scope.length === 0} className="px-6 py-2 bg-cb-primary text-white rounded-md font-medium hover:bg-red-700 disabled:opacity-50">
          {loading ? 'Running...' : 'Run Audit'}
        </button>
      </div>

      {/* Past runs */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Past Audits</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Date</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Scope</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Mode</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Scanned</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Flagged</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-600">{new Date(run.started_at).toLocaleString()}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {run.scan_scope.map((s) => (
                      <span key={s} className="inline-block bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded capitalize">{s}</span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-600 capitalize">{run.scan_mode}</td>
                <td className="px-4 py-3 text-gray-900">{run.total_items_scanned}</td>
                <td className="px-4 py-3 text-red-600 font-medium">{run.total_flagged}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block text-xs px-2 py-0.5 rounded-full ${run.status === 'complete' ? 'bg-green-100 text-green-700' : run.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                    {run.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {run.status === 'complete' && (
                    <button onClick={() => setSelectedRun(run)} className="text-sm text-cb-primary hover:underline">
                      View results
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {runs.length === 0 && <p className="p-8 text-center text-gray-500">No audits run yet.</p>}
      </div>

      <ConfirmDialog />
    </div>
  );
}
