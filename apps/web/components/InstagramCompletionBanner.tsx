'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@chefsbook/db';
import { X, Loader2, CheckCircle, AlertTriangle, ChevronRight } from 'lucide-react';

interface CompletionStatus {
  pending: number;
  processing: number;
  complete: number;
  failed: number;
  total: number;
  isActive: boolean;
}

export default function InstagramCompletionBanner() {
  const router = useRouter();
  const [status, setStatus] = useState<CompletionStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const processingRef = useRef(false);

  const fetchStatus = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const res = await fetch('/api/import/instagram-export/completion-status', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setStatus(data);

        // If there are pending jobs, trigger processing
        if (data.pending > 0 && !processingRef.current) {
          processingRef.current = true;
          try {
            await fetch('/api/import/instagram-export/process-jobs', {
              method: 'POST',
              headers: { Authorization: `Bearer ${session.access_token}` },
            });
          } catch (e) {
            console.error('[InstagramCompletionBanner] Process error:', e);
          }
          processingRef.current = false;
        }
      }
    } catch (e) {
      console.error('[InstagramCompletionBanner] Fetch error:', e);
    }
  }, []);

  const retryFailed = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      await fetch('/api/import/instagram-export/retry-failed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({}),
      });

      fetchStatus();
    } catch (e) {
      console.error('[InstagramCompletionBanner] Retry error:', e);
    }
  }, [fetchStatus]);

  useEffect(() => {
    fetchStatus();

    pollingRef.current = setInterval(() => {
      if (status?.isActive) {
        fetchStatus();
      }
    }, 5000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [fetchStatus, status?.isActive]);

  // Re-fetch when status changes to check if we need to keep polling
  useEffect(() => {
    if (status && !status.isActive && pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    } else if (status?.isActive && !pollingRef.current) {
      pollingRef.current = setInterval(fetchStatus, 5000);
    }
  }, [status, fetchStatus]);

  if (!status || status.total === 0 || dismissed) return null;

  // Don't show banner if all complete and no failed
  if (!status.isActive && status.failed === 0) return null;

  const completed = status.complete;
  const total = status.total;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-b border-purple-100 px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <button
          onClick={() => router.push('/dashboard/scan')}
          className="flex items-center gap-3 flex-1 min-w-0 text-left"
        >
          {status.isActive ? (
            <Loader2 className="w-5 h-5 text-purple-600 animate-spin shrink-0" />
          ) : status.failed > 0 ? (
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
          ) : (
            <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
          )}

          <div className="flex-1 min-w-0">
            {status.isActive ? (
              <p className="text-sm font-medium text-purple-900 truncate">
                Generating recipes from Instagram import — {completed} / {total} complete
              </p>
            ) : status.failed > 0 ? (
              <p className="text-sm font-medium text-amber-900 truncate">
                {completed} complete, {status.failed} failed
              </p>
            ) : (
              <p className="text-sm font-medium text-green-900 truncate">
                All {total} recipes generated successfully!
              </p>
            )}

            {status.isActive && (
              <div className="mt-1 w-full h-1.5 bg-purple-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
          </div>

          <ChevronRight className="w-4 h-4 text-purple-400 shrink-0" />
        </button>

        <div className="flex items-center gap-2 shrink-0">
          {status.failed > 0 && !status.isActive && (
            <button
              onClick={(e) => { e.stopPropagation(); retryFailed(); }}
              className="text-xs font-medium text-purple-600 hover:text-purple-800 px-2 py-1 rounded hover:bg-purple-100 transition-colors"
            >
              Retry failed
            </button>
          )}

          <button
            onClick={() => setDismissed(true)}
            className="p-1 rounded hover:bg-purple-100 transition-colors"
          >
            <X className="w-4 h-4 text-purple-400" />
          </button>
        </div>
      </div>
    </div>
  );
}
