'use client';

import { useState } from 'react';
import { supabase } from '@chefsbook/db';
import { SousChefSuggestModal } from './SousChefSuggestModal';

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
  const [status, setStatus] = useState<'idle' | 'refreshing' | 'ok' | 'error' | 'needs-ext' | 'suggesting'>('idle');
  const [msg, setMsg] = useState<string>('');
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pasting, setPasting] = useState(false);
  const [showSousChefModal, setShowSousChefModal] = useState(false);
  const [sousChefSuggestions, setSousChefSuggestions] = useState<any>(null);
  const [hadSourceScrape, setHadSourceScrape] = useState(false);

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

      // Get current user ID
      const { data: userData } = await supabase.auth.getUser(token);
      const userId = userData.user?.id;
      if (!userId) throw new Error('User not found');

      // Merge ingredients
      if (data.ingredients && data.ingredients.length > 0) {
        // Get existing ingredients count
        const { count: existingCount } = await supabase
          .from('recipe_ingredients')
          .select('*', { count: 'exact', head: true })
          .eq('recipe_id', recipeId);

        const startSortOrder = (existingCount ?? 0) + 1;

        // Insert new ingredients
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

      // Add steps (only if none existed)
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

      // Check completeness and show publish dialog if needed
      const { data: updatedRecipe } = await supabase
        .from('recipes')
        .select('visibility, is_complete')
        .eq('id', recipeId)
        .single();

      setStatus('ok');
      setMsg('Recipe updated by your Sous Chef ✨');

      // Re-evaluate completeness via finalize endpoint
      await fetch('/api/recipes/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ recipeId }),
      });

      onRefreshed?.();

      // Check if we should show publish prompt
      if (updatedRecipe?.visibility === 'private') {
        const { data: ingredients } = await supabase
          .from('recipe_ingredients')
          .select('quantity')
          .eq('recipe_id', recipeId);

        const { data: steps } = await supabase
          .from('recipe_steps')
          .select('id')
          .eq('recipe_id', recipeId);

        const { data: recipe } = await supabase
          .from('recipes')
          .select('title, description')
          .eq('id', recipeId)
          .single();

        const hasMinIngredients = (ingredients?.length ?? 0) >= 2 && ingredients?.some(i => i.quantity);
        const hasSteps = (steps?.length ?? 0) >= 1;
        const hasTitle = !!recipe?.title;
        const hasDescription = !!recipe?.description;

        if (hasMinIngredients && hasSteps && hasTitle && hasDescription) {
          // Show publish dialog
          const shouldPublish = window.confirm(
            'Your recipe is ready to share with the Chefsbook community. Would you like to publish it?'
          );

          if (shouldPublish) {
            await supabase
              .from('recipes')
              .update({ visibility: 'public' })
              .eq('id', recipeId);

            setMsg('Your recipe is now public 🎉');
            onRefreshed?.();
          }
        }
      }
    } catch (e: any) {
      setStatus('error');
      setMsg(String(e?.message ?? e));
      throw e;
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
          <div className="mt-2 flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={refresh}
              disabled={status === 'refreshing' || status === 'suggesting'}
              className="inline-flex items-center gap-1.5 text-sm bg-cb-primary text-white rounded-full px-3 py-1 disabled:opacity-60"
            >
              {status === 'refreshing' ? 'Refreshing…' : '🔄 Refresh from source'}
            </button>
            <button
              type="button"
              onClick={() => setShowPaste(!showPaste)}
              disabled={status === 'refreshing' || status === 'suggesting'}
              className="inline-flex items-center gap-1.5 text-sm border border-amber-300 text-amber-900 rounded-full px-3 py-1 hover:bg-amber-100 disabled:opacity-60"
            >
              📋 Paste {missingFields[0] ?? 'text'}
            </button>
            <button
              type="button"
              onClick={triggerSousChef}
              disabled={status === 'refreshing' || status === 'suggesting'}
              className="inline-flex items-center gap-1.5 text-sm bg-cb-primary text-white rounded-full px-3 py-1 disabled:opacity-60"
            >
              {status === 'suggesting' ? 'Preparing…' : '✨ Sous Chef'}
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
          {showPaste && (
            <div className="mt-3">
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={`Paste the ${missingFields.join(' and ')} here...`}
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
                    // Merge pasted content into existing recipe
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

      {/* Sous Chef Modal */}
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
