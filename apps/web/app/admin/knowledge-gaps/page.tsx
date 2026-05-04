'use client';

import { useState, useEffect } from 'react';
import { adminFetch, adminPost } from '@/lib/adminFetch';
import type { KnowledgeGap, KnowledgeGapStats } from '@chefsbook/db';

type StatusFilter = 'all' | 'detected' | 'approved' | 'active' | 'agent_hunting' | 'filled' | 'dismissed';

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  detected: { bg: 'bg-gray-100', text: 'text-gray-700' },
  approved: { bg: 'bg-blue-100', text: 'text-blue-700' },
  active: { bg: 'bg-green-100', text: 'text-green-700' },
  agent_hunting: { bg: 'bg-purple-100', text: 'text-purple-700' },
  filled: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  dismissed: { bg: 'bg-red-100', text: 'text-red-700' },
};

const PRIORITY_STYLES: Record<string, { bg: string; text: string }> = {
  critical: { bg: 'bg-red-100', text: 'text-red-700' },
  high: { bg: 'bg-orange-100', text: 'text-orange-700' },
  medium: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  low: { bg: 'bg-gray-100', text: 'text-gray-600' },
};

export default function KnowledgeGapsPage() {
  const [gaps, setGaps] = useState<KnowledgeGap[]>([]);
  const [stats, setStats] = useState<KnowledgeGapStats | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Approve modal state
  const [approveModal, setApproveModal] = useState<KnowledgeGap | null>(null);
  const [requestTitle, setRequestTitle] = useState('');
  const [requestBody, setRequestBody] = useState('');
  const [fillThreshold, setFillThreshold] = useState(5);
  const [approveSaving, setApproveSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [gapsData, statsData] = await Promise.all([
        adminFetch({ page: 'knowledge-gaps', status: statusFilter }),
        adminFetch({ page: 'knowledge-gaps-stats' }),
      ]);
      setGaps(gapsData.gaps || []);
      setStats(statsData.stats || null);
    } catch (e: any) {
      setError(e.message || 'Failed to load knowledge gaps');
    } finally {
      setLoading(false);
    }
  };

  const handleDetectGaps = async () => {
    try {
      const result = await adminFetch({ page: 'knowledge-gaps-detect', method: 'POST' });
      alert(`Gap detection complete:\n${result.detected} detected\n${result.updated} updated\n${result.filled} filled`);
      loadData();
    } catch (e: any) {
      alert(`Failed to detect gaps: ${e.message}`);
    }
  };

  const openApproveModal = (gap: KnowledgeGap) => {
    setApproveModal(gap);
    // Pre-fill with AI-suggested copy
    const ingredient = gap.ingredient_category ? ` ${gap.ingredient_category}` : '';
    setRequestTitle(`a great ${gap.technique}${ingredient} recipe`);
    setRequestBody(`Our Sous Chef doesn't know much about this technique yet. Help teach ChefsBook something new!`);
    setFillThreshold(gap.fill_threshold);
  };

  const handleApprove = async () => {
    if (!approveModal) return;
    setApproveSaving(true);
    try {
      await adminPost({
        action: 'approveGap',
        gapId: approveModal.id,
        requestTitle,
        requestBody,
        fillThreshold,
      });
      setApproveModal(null);
      loadData();
    } catch (e: any) {
      alert(`Failed to approve gap: ${e.message}`);
    } finally {
      setApproveSaving(false);
    }
  };

  const handleGoLive = async (gapId: string) => {
    if (!confirm('Make this gap active? It will appear as a community request card.')) return;
    try {
      await adminPost({ action: 'activateGap', gapId });
      loadData();
    } catch (e: any) {
      alert(`Failed to activate gap: ${e.message}`);
    }
  };

  const handleDismiss = async (gapId: string) => {
    if (!confirm('Dismiss this gap? It will be marked as not worth pursuing.')) return;
    try {
      await adminPost({ action: 'dismissGap', gapId });
      loadData();
    } catch (e: any) {
      alert(`Failed to dismiss gap: ${e.message}`);
    }
  };

  const handleFindRecipes = async (gapId: string) => {
    if (!confirm('Trigger agent URL discovery? This will cost ~$0.01 per search.')) return;
    try {
      const result = await adminPost({ action: 'findGapRecipes', gapId });
      alert(`Found ${result.urls?.length || 0} candidate URLs`);
      loadData();
    } catch (e: any) {
      alert(`Failed to find recipes: ${e.message}`);
    }
  };

  if (loading && !gaps.length) {
    return <div className="text-gray-500">Loading knowledge gaps...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Knowledge Gaps</h1>
        <button
          onClick={handleDetectGaps}
          className="px-4 py-2 bg-cb-primary text-white rounded-md hover:bg-cb-primary/90"
        >
          Detect Gaps
        </button>
      </div>

      {/* KPI Cards */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-500">Total Gaps</div>
            <div className="text-2xl font-bold text-gray-900">{stats.total_gaps}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-500">Active Requests</div>
            <div className="text-2xl font-bold text-green-600">{stats.active_requests}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-500">Filled This Month</div>
            <div className="text-2xl font-bold text-emerald-600">{stats.filled_this_month}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-500">Avg Observations</div>
            <div className="text-2xl font-bold text-gray-900">{stats.avg_observations}</div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {(['all', 'detected', 'approved', 'active', 'agent_hunting', 'filled', 'dismissed'] as StatusFilter[]).map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              statusFilter === status
                ? 'border-cb-primary text-cb-primary'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            {status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Gap Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Technique + Ingredient</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Observations</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Detected</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {gaps.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  No gaps found for this filter
                </td>
              </tr>
            ) : (
              gaps.map((gap) => (
                <tr key={gap.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{gap.technique}</div>
                    {gap.ingredient_category && (
                      <div className="text-sm text-gray-500">{gap.ingredient_category}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {gap.observation_count} / {gap.fill_threshold}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${PRIORITY_STYLES[gap.priority].bg} ${PRIORITY_STYLES[gap.priority].text}`}>
                      {gap.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${STATUS_STYLES[gap.status].bg} ${STATUS_STYLES[gap.status].text}`}>
                      {gap.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(gap.detected_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    {gap.status === 'detected' && (
                      <button
                        onClick={() => openApproveModal(gap)}
                        className="text-sm text-blue-600 hover:text-blue-800"
                      >
                        Approve
                      </button>
                    )}
                    {gap.status === 'approved' && (
                      <button
                        onClick={() => handleGoLive(gap.id)}
                        className="text-sm text-green-600 hover:text-green-800"
                      >
                        Go Live
                      </button>
                    )}
                    {(gap.status === 'active' || gap.status === 'approved') && (
                      <button
                        onClick={() => handleFindRecipes(gap.id)}
                        className="text-sm text-purple-600 hover:text-purple-800"
                      >
                        Find Recipes
                      </button>
                    )}
                    {gap.status !== 'filled' && gap.status !== 'dismissed' && (
                      <button
                        onClick={() => handleDismiss(gap.id)}
                        className="text-sm text-red-600 hover:text-red-800"
                      >
                        Dismiss
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Approve Modal */}
      {approveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Approve Knowledge Gap</h2>
              <p className="text-sm text-gray-500 mt-1">
                {approveModal.technique} {approveModal.ingredient_category ? `· ${approveModal.ingredient_category}` : ''}
              </p>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Request Title
                </label>
                <input
                  type="text"
                  value={requestTitle}
                  onChange={(e) => setRequestTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="e.g., a great rotisserie chicken recipe"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Request Body
                </label>
                <textarea
                  value={requestBody}
                  onChange={(e) => setRequestBody(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Message shown to users"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fill Threshold
                </label>
                <input
                  type="number"
                  value={fillThreshold}
                  onChange={(e) => setFillThreshold(parseInt(e.target.value) || 5)}
                  min={1}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
                <p className="text-xs text-gray-500 mt-1">
                  How many observations needed before marking as filled
                </p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
              <button
                onClick={() => setApproveModal(null)}
                disabled={approveSaving}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                disabled={approveSaving}
                className="px-4 py-2 text-sm bg-cb-primary text-white rounded-md hover:bg-cb-primary/90 disabled:opacity-50"
              >
                {approveSaving ? 'Approving...' : 'Approve'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
