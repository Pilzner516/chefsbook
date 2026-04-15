'use client';

import { useState } from 'react';
import { supabase } from '@chefsbook/db';

interface Props {
  recipeId: string;
  sourceUrl: string | null | undefined;
  missingFields: string[];
  onRefreshed?: () => void;
}

/**
 * Amber banner shown on incomplete recipes offering a one-click re-import
 * from the original source. When the server can't fetch (bot-protected site),
 * hands off to the installed browser extension via postMessage.
 */
export function RefreshFromSourceBanner({ recipeId, sourceUrl, missingFields, onRefreshed }: Props) {
  const [status, setStatus] = useState<'idle' | 'refreshing' | 'ok' | 'error' | 'needs-ext'>('idle');
  const [msg, setMsg] = useState<string>('');

  if (!sourceUrl || missingFields.length === 0) return null;

  const triggerExtension = (url: string) => {
    const requestId = `rf_${Date.now()}`;
    const handler = (ev: MessageEvent) => {
      const d: any = ev.data;
      if (d?.type !== 'CHEFSBOOK_PDF_IMPORT_RESULT' || d.requestId !== requestId) return;
      window.removeEventListener('message', handler);
      if (d.ok) {
        setStatus('ok');
        setMsg('Recipe refreshed via browser extension.');
        onRefreshed?.();
      } else {
        setStatus('error');
        setMsg(d.error ?? 'Extension import failed.');
      }
    };
    window.addEventListener('message', handler);
    window.postMessage({ type: 'CHEFSBOOK_PDF_IMPORT', url, requestId }, '*');
  };

  const hasExtension = typeof document !== 'undefined' && !!document.documentElement.dataset.chefsbookExtension;

  const refresh = async () => {
    setStatus('refreshing');
    setMsg('');
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) { setStatus('error'); setMsg('Please sign in.'); return; }
      const res = await fetch('/api/recipes/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ recipeId }),
      });
      const body = await res.json();
      if (res.status === 206 && body.needsBrowserExtraction) {
        if (hasExtension) {
          triggerExtension(sourceUrl);
          return;
        }
        setStatus('needs-ext');
        setMsg(body.message ?? 'Install the ChefsBook browser extension to refresh this recipe.');
        return;
      }
      if (!res.ok) { setStatus('error'); setMsg(body.error ?? 'Refresh failed.'); return; }
      const added: string[] = [];
      if (body.ingredientsAdded) added.push(`${body.ingredientsAdded} ingredient${body.ingredientsAdded === 1 ? '' : 's'}`);
      if (body.stepsAdded) added.push(`${body.stepsAdded} step${body.stepsAdded === 1 ? '' : 's'}`);
      setStatus('ok');
      setMsg(added.length ? `Added ${added.join(' and ')}.` : 'Recipe looked up — nothing new to add.');
      onRefreshed?.();
    } catch (e: any) {
      setStatus('error');
      setMsg(String(e?.message ?? e));
    }
  };

  return (
    <div className="rounded-card border border-amber-200 bg-amber-50 px-4 py-3 mb-4">
      <div className="flex items-start gap-3">
        <span className="text-xl leading-none" aria-hidden>⚠️</span>
        <div className="flex-1">
          <div className="font-medium text-amber-900">
            This recipe is missing {missingFields.join(', ')}
          </div>
          {status === 'idle' && (
            <div className="mt-1 text-sm text-amber-800">
              We can re-fetch it from the original source and fill in the gaps — your existing edits are preserved.
            </div>
          )}
          {status !== 'idle' && msg && (
            <div className={`mt-1 text-sm ${status === 'error' ? 'text-red-700' : status === 'ok' ? 'text-green-700' : 'text-amber-800'}`}>
              {msg}
            </div>
          )}
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={refresh}
              disabled={status === 'refreshing'}
              className="inline-flex items-center gap-1.5 text-sm bg-cb-primary text-white rounded-full px-3 py-1 disabled:opacity-60"
            >
              {status === 'refreshing' ? 'Refreshing…' : '🔄 Refresh from source'}
            </button>
            {status === 'needs-ext' && (
              <a
                href="/extension"
                className="inline-flex items-center gap-1.5 text-sm border border-amber-300 text-amber-900 rounded-full px-3 py-1 hover:bg-amber-100"
              >
                Install extension
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
