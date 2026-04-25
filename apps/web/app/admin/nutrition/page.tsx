'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@chefsbook/db';

interface NutritionStats {
  total: number;
  hasNutrition: number;
  needsNutrition: number;
}

interface GenerationLogEntry {
  recipeId: string;
  title: string;
  generatedAt: string;
  confidence: number | null;
  status: 'success' | 'skipped' | 'error';
  reason?: string;
}

export default function AdminNutritionPage() {
  const [stats, setStats] = useState<NutritionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState({ processed: 0, total: 0, errors: 0, skipped: 0 });
  const [log, setLog] = useState<GenerationLogEntry[]>([]);
  const [status, setStatus] = useState<'idle' | 'running' | 'complete' | 'error'>('idle');
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch('/api/admin/nutrition/stats', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleGenerateAll = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    setGenerating(true);
    setStatus('running');
    setProgress({ processed: 0, total: stats?.needsNutrition ?? 0, errors: 0, skipped: 0 });
    setLog([]);

    abortControllerRef.current = new AbortController();

    try {
      const res = await fetch('/api/admin/nutrition/bulk-generate', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
        signal: abortControllerRef.current.signal,
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Request failed');
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') {
            setStatus('complete');
            continue;
          }
          try {
            const event = JSON.parse(data);
            if (event.type === 'progress') {
              setProgress(event.progress);
            } else if (event.type === 'recipe') {
              setLog((prev) => [event.entry, ...prev].slice(0, 20));
            } else if (event.type === 'error') {
              console.error('Bulk generation error:', event.message);
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      }

      setStatus('complete');
      fetchStats();
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setStatus('idle');
      } else {
        console.error('Bulk generation failed:', err);
        setStatus('error');
      }
    } finally {
      setGenerating(false);
      abortControllerRef.current = null;
    }
  };

  const handleCancel = () => {
    abortControllerRef.current?.abort();
  };

  const estimatedMinutes = stats ? Math.ceil(stats.needsNutrition / 60) : 0;

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Nutrition Management</h1>

      {/* Stats card */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Statistics</h2>
        {loading ? (
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-gray-200 rounded w-1/2" />
            <div className="h-4 bg-gray-200 rounded w-1/3" />
            <div className="h-4 bg-gray-200 rounded w-1/4" />
          </div>
        ) : stats ? (
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-sm text-gray-600">Total recipes</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-3xl font-bold text-green-700">{stats.hasNutrition}</p>
              <p className="text-sm text-gray-600">
                With nutrition ({stats.total > 0 ? Math.round((stats.hasNutrition / stats.total) * 100) : 0}%)
              </p>
            </div>
            <div className="text-center p-4 bg-amber-50 rounded-lg">
              <p className="text-3xl font-bold text-amber-700">{stats.needsNutrition}</p>
              <p className="text-sm text-gray-600">Needs generation</p>
            </div>
          </div>
        ) : (
          <p className="text-gray-500">Failed to load statistics</p>
        )}
      </div>

      {/* Bulk generation card */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Bulk Generation</h2>
        <p className="text-sm text-gray-600 mb-4">
          Generate nutrition data for all recipes that don't have it yet.
          <br />
          Processing rate: 1 recipe/second (Anthropic rate limit)
          {stats && stats.needsNutrition > 0 && (
            <>
              <br />
              Estimated time: ~{estimatedMinutes} minute{estimatedMinutes !== 1 ? 's' : ''} for {stats.needsNutrition} recipes
            </>
          )}
        </p>

        <div className="flex items-center gap-4 mb-4">
          {generating ? (
            <button
              onClick={handleCancel}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
            >
              Cancel
            </button>
          ) : (
            <button
              onClick={handleGenerateAll}
              disabled={!stats || stats.needsNutrition === 0}
              className="px-4 py-2 bg-cb-primary text-white rounded-lg hover:bg-cb-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Generate All
            </button>
          )}
          <span className={`text-sm font-medium ${
            status === 'idle' ? 'text-gray-500' :
            status === 'running' ? 'text-blue-600' :
            status === 'complete' ? 'text-green-600' :
            'text-red-600'
          }`}>
            Status: {status}
          </span>
        </div>

        {/* Progress bar */}
        {status === 'running' && (
          <div className="mb-4">
            <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
              <div
                className="bg-cb-primary h-3 rounded-full transition-all duration-300"
                style={{ width: `${progress.total > 0 ? (progress.processed / progress.total) * 100 : 0}%` }}
              />
            </div>
            <p className="text-sm text-gray-600">
              Processing: {progress.processed} / {progress.total} recipes
              {progress.skipped > 0 && <span className="text-amber-600 ml-2">Skipped: {progress.skipped}</span>}
              {progress.errors > 0 && <span className="text-red-600 ml-2">Errors: {progress.errors}</span>}
            </p>
          </div>
        )}
      </div>

      {/* Recent generations log */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Generations (last 20)</h2>
        {log.length === 0 ? (
          <p className="text-gray-500 text-sm">No generations yet. Click "Generate All" to start.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 font-medium text-gray-600">Recipe</th>
                  <th className="text-left py-2 font-medium text-gray-600">Time</th>
                  <th className="text-left py-2 font-medium text-gray-600">Confidence</th>
                  <th className="text-left py-2 font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {log.map((entry, i) => (
                  <tr key={`${entry.recipeId}-${i}`} className="border-b border-gray-100">
                    <td className="py-2 text-gray-900 truncate max-w-xs">{entry.title}</td>
                    <td className="py-2 text-gray-500">{formatRelativeTime(entry.generatedAt)}</td>
                    <td className="py-2">
                      {entry.confidence !== null ? (
                        <span className={`font-medium ${
                          entry.confidence >= 0.7 ? 'text-green-600' :
                          entry.confidence >= 0.5 ? 'text-amber-600' :
                          'text-red-600'
                        }`}>
                          {entry.confidence.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="py-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        entry.status === 'success' ? 'bg-green-100 text-green-800' :
                        entry.status === 'skipped' ? 'bg-amber-100 text-amber-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {entry.status}
                        {entry.reason && <span className="ml-1 text-gray-600">({entry.reason})</span>}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function formatRelativeTime(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const seconds = Math.floor((now - then) / 1000);

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days !== 1 ? 's' : ''} ago`;
}
