'use client';

import { useState } from 'react';
import { supabase } from '@chefsbook/db';
import { SousChefSuggestModal } from './SousChefSuggestModal';

interface Props {
  recipeId: string;
  sourceUrl: string | null | undefined;
  missingFields: string[];
  moderationStatus: string | null | undefined;
  aiRecipeVerdict: string | null | undefined;
  onRefreshed?: () => void;
}

/**
 * Merged smart banner (Prompt L) shown when recipe is incomplete OR flagged.
 * Replaces RefreshFromSourceBanner with unified UX for both states.
 */
export function RecipeStatusBanner({ recipeId, sourceUrl, missingFields, moderationStatus, aiRecipeVerdict, onRefreshed }: Props) {
  const [status, setStatus] = useState<'idle' | 'refreshing' | 'ok' | 'error' | 'needs-ext' | 'suggesting'>('idle');
  const [msg, setMsg] = useState<string>('');
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pasting, setPasting] = useState(false);
  const [showSousChefModal, setShowSousChefModal] = useState(false);
  const [sousChefSuggestions, setSousChefSuggestions] = useState<any>(null);
  const [hadSourceScrape, setHadSourceScrape] = useState(false);

  // Determine banner variant
  const isFlagged = moderationStatus === 'flagged' || moderationStatus === 'flagged_serious' || moderationStatus === 'flagged_mild' || aiRecipeVerdict === 'flagged' || aiRecipeVerdict === 'not_a_recipe';
  const isIncomplete = missingFields.length > 0;

  // Don't show banner if neither condition applies
  if (!isFlagged && !isIncomplete) return null;

  // Build reason text from missing fields
  const buildReasonText = () => {
    const fields = missingFields;
    if (fields.includes('title') || fields.includes('description')) {
      return "It's missing a title or description.";
    }
    if (fields.includes('ingredients (minimum 2)') && fields.includes('steps')) {
      return "It's missing ingredients and steps.";
    }
    if (fields.includes('ingredients (minimum 2)')) {
      return "It's missing ingredients (minimum 2).";
    }
    if (fields.includes('ingredient quantities')) {
      return "It's missing ingredient quantities.";
    }
    if (fields.includes('steps')) {
      return "It's missing steps.";
    }
    return `It's missing ${fields.join(', ')}.`;
  };

  // Flagged/under review variant
  if (isFlagged) {
    return (
      <div className="rounded-card border border-red-200 bg-red-50 px-4 py-3 mb-4">
        <div className="flex items-start gap-3">
          <span className="text-xl leading-none" aria-hidden>🔍</span>
          <div className="flex-1">
            <div className="font-medium text-red-900">
              This recipe is under review by Chefsbook
            </div>
            <div className="mt-1 text-sm text-red-800">
              Our team is reviewing this recipe. You'll be notified when it's cleared. In the meantime, it's only visible to you.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Incomplete variant
  const missingTitleOrDesc = missingFields.includes('title') || missingFields.includes('description');
  const hasExtension = typeof document !== 'undefined' && !!document.documentElement.dataset.chefsbookExtension;

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
          triggerExtension(sourceUrl!);
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

  const triggerSousChef = async () => {
    setStatus('suggesting');
    setMsg('Your Sous Chef is preparing this recipe…');
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) { setStatus('error'); setMsg('Please sign in.'); return; }

      const res = await fetch(`/api/recipes/${recipeId}/sous-chef-suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      });

      const body = await res.json();
      if (!res.ok) {
        setStatus('error');
        setMsg(body.error ?? 'Sous Chef suggestion failed.');
        return;
      }

      setSousChefSuggestions(body.suggestions);
      setHadSourceScrape(body.hadSourceScrape);
      setShowSousChefModal(true);
      setStatus('idle');
      setMsg('');
    } catch (e: any) {
      setStatus('error');
      setMsg(String(e?.message ?? e));
    }
  };

  const handleSousChefSave = async (data: { ingredients?: any[]; steps?: any[] }) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Please sign in.');

      const { data: userData } = await supabase.auth.getUser(token);
      const userId = userData.user?.id;
      if (!userId) throw new Error('User not found');

      if (data.ingredients && data.ingredients.length > 0) {
        const { count: existingCount } = await supabase
          .from('recipe_ingredients')
          .select('*', { count: 'exact', head: true })
          .eq('recipe_id', recipeId);

        const startSortOrder = (existingCount ?? 0) + 1;

        const ingredientsToInsert = data.ingredients.map((ing, idx) => ({
          recipe_id: recipeId,
          user_id: userId,
          sort_order: startSortOrder + idx,
          quantity: ing.quantity ? parseFloat(ing.quantity) : null,
          unit: ing.unit || null,
          ingredient: ing.ingredient,
          preparation: ing.preparation || null,
        }));

        const { error: ingError } = await supabase
          .from('recipe_ingredients')
          .insert(ingredientsToInsert);

        if (ingError) throw ingError;
      }

      if (data.steps && data.steps.length > 0) {
        const stepsToInsert = data.steps.map((step) => ({
          recipe_id: recipeId,
          user_id: userId,
          step_number: step.step_number,
          instruction: step.instruction,
        }));

        const { error: stepError } = await supabase
          .from('recipe_steps')
          .insert(stepsToInsert);

        if (stepError) throw stepError;
      }

      setStatus('ok');
      setMsg('Recipe updated by your Sous Chef ✨');

      await fetch('/api/recipes/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ recipeId }),
      });

      onRefreshed?.();
    } catch (e: any) {
      setStatus('error');
      setMsg(String(e?.message ?? e));
      throw e;
    }
  };

  // Determine which field to paste based on what's missing
  const pasteFieldLabel = missingFields.includes('ingredients (minimum 2)') || missingFields.includes('ingredient quantities')
    ? 'ingredients'
    : missingFields.includes('steps')
    ? 'steps'
    : missingFields[0] ?? 'text';

  return (
    <div className="rounded-card border border-amber-200 bg-amber-50 px-4 py-3 mb-4">
      <div className="flex items-start gap-3">
        <span className="text-xl leading-none" aria-hidden>⚠️</span>
        <div className="flex-1">
          <div className="font-medium text-amber-900">
            This recipe can't be published yet
          </div>
          <div className="mt-1 text-sm text-amber-800">
            {buildReasonText()}
            {!missingTitleOrDesc && " Your Sous Chef can help fill in the gaps — your existing edits are preserved."}
          </div>
          {status !== 'idle' && msg && (
            <div className={`mt-1 text-sm ${status === 'error' ? 'text-red-700' : status === 'ok' ? 'text-green-700' : 'text-amber-800'}`}>
              {msg}
            </div>
          )}
          <div className="mt-2 flex gap-2 flex-wrap">
            {!missingTitleOrDesc && sourceUrl && (
              <button
                type="button"
                onClick={refresh}
                disabled={status === 'refreshing' || status === 'suggesting'}
                className="inline-flex items-center gap-1.5 text-sm bg-cb-primary text-white rounded-full px-3 py-1 disabled:opacity-60"
              >
                {status === 'refreshing' ? 'Refreshing…' : '🔄 Refresh from source'}
              </button>
            )}
            {!missingTitleOrDesc && (
              <button
                type="button"
                onClick={() => setShowPaste(!showPaste)}
                disabled={status === 'refreshing' || status === 'suggesting'}
                className="inline-flex items-center gap-1.5 text-sm border border-amber-300 text-amber-900 rounded-full px-3 py-1 hover:bg-amber-100 disabled:opacity-60"
              >
                📋 Paste {pasteFieldLabel}
              </button>
            )}
            {!missingTitleOrDesc && (
              <button
                type="button"
                onClick={triggerSousChef}
                disabled={status === 'refreshing' || status === 'suggesting'}
                className="inline-flex items-center gap-1.5 text-sm bg-cb-primary text-white rounded-full px-3 py-1 disabled:opacity-60"
              >
                {status === 'suggesting' ? 'Preparing…' : '✨ Sous Chef'}
              </button>
            )}
            {status === 'needs-ext' && (
              <a
                href="/extension"
                className="inline-flex items-center gap-1.5 text-sm border border-amber-300 text-amber-900 rounded-full px-3 py-1 hover:bg-amber-100"
              >
                Install extension
              </a>
            )}
          </div>
          {showPaste && (
            <div className="mt-3">
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={`Paste the ${pasteFieldLabel} here...`}
                rows={4}
                className="w-full bg-white border border-amber-300 rounded-input px-3 py-2 text-sm resize-none outline-none focus:border-cb-primary"
              />
              <button
                type="button"
                onClick={async () => {
                  if (!pasteText.trim()) return;
                  setPasting(true);
                  try {
                    const res = await fetch('/api/import/text', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ text: pasteText }),
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error);
                    const recipe = data.recipe;
                    const { data: session } = await supabase.auth.getSession();
                    if (recipe.ingredients?.length) {
                      const token = session.session?.access_token;
                      if (!token) throw new Error('Please sign in to save ingredients.');
                      const mergeRes = await fetch('/api/recipes/refresh', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ recipeId, pastedIngredients: recipe.ingredients }),
                      });
                      const mergeData = await mergeRes.json();
                      if (!mergeRes.ok) throw new Error(mergeData.error ?? 'Failed to save ingredients.');
                    }
                    setStatus('ok');
                    setMsg(`Parsed ${recipe.ingredients?.length ?? 0} ingredients from pasted text.`);
                    setShowPaste(false);
                    onRefreshed?.();
                  } catch (e: any) {
                    setStatus('error');
                    setMsg(e.message);
                  } finally {
                    setPasting(false);
                  }
                }}
                disabled={!pasteText.trim() || pasting}
                className="mt-2 inline-flex items-center gap-1.5 text-sm bg-cb-green text-white rounded-full px-4 py-1.5 disabled:opacity-50"
              >
                {pasting ? 'Parsing...' : 'Save'}
              </button>
            </div>
          )}
        </div>
      </div>

      {showSousChefModal && sousChefSuggestions && (
        <SousChefSuggestModal
          isOpen={showSousChefModal}
          onClose={() => setShowSousChefModal(false)}
          suggestions={sousChefSuggestions}
          hadSourceScrape={hadSourceScrape}
          onSave={handleSousChefSave}
        />
      )}
    </div>
  );
}
