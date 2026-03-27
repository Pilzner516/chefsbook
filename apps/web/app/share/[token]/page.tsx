'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getRecipeByShareToken } from '@chefsbook/db';
import type { RecipeWithDetails } from '@chefsbook/db';
import { formatDuration, formatQuantity, scaleQuantity } from '@chefsbook/ui';

export default function SharedRecipePage() {
  const { token } = useParams<{ token: string }>();
  const [recipe, setRecipe] = useState<RecipeWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [servings, setServings] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      const data = await getRecipeByShareToken(token);
      setRecipe(data);
      if (data) setServings(data.servings);
      setLoading(false);
    })();
  }, [token]);

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-cb-bg">
        <Nav />
        <div className="text-center text-cb-muted py-20">Loading recipe...</div>
      </main>
    );
  }

  if (!recipe) {
    return (
      <main className="min-h-screen bg-cb-bg">
        <Nav />
        <div className="max-w-lg mx-auto text-center py-24 px-6">
          <div className="w-16 h-16 rounded-full bg-cb-primary/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-cb-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold mb-2">Recipe not found</h2>
          <p className="text-cb-muted text-sm mb-6">
            This shared link may have expired or been removed.
          </p>
          <Link
            href="/"
            className="inline-block bg-cb-primary text-white px-6 py-3 rounded-input text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Go to Chefsbook
          </Link>
        </div>
      </main>
    );
  }

  const originalServings = recipe.servings;

  return (
    <main className="min-h-screen bg-cb-bg">
      <Nav />

      {/* Shared banner */}
      <div className="bg-cb-card border-b border-cb-border">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-cb-muted">
            <svg className="w-4 h-4 text-cb-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" />
            </svg>
            Someone shared this recipe with you via Chefsbook
          </div>
          <button
            onClick={handleShare}
            className="text-sm text-cb-primary font-medium hover:underline"
          >
            {copied ? 'Link copied!' : 'Copy link'}
          </button>
        </div>
      </div>

      {/* Hero image */}
      {recipe.image_url && (
        <div className="max-w-4xl mx-auto px-6 mt-8">
          <div className="h-80 rounded-card overflow-hidden bg-cb-card">
            <img
              src={recipe.image_url}
              alt={recipe.title}
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      )}

      <article className="max-w-4xl mx-auto py-10 px-6">
        {/* Title */}
        <h1 className="text-4xl font-bold mb-4 tracking-tight">{recipe.title}</h1>
        {recipe.description && (
          <p className="text-cb-muted text-lg mb-6 leading-relaxed">{recipe.description}</p>
        )}

        {/* Meta tags */}
        <div className="flex flex-wrap gap-3 mb-8">
          {recipe.cuisine && (
            <span className="bg-cb-primary/10 text-cb-primary text-sm px-3 py-1.5 rounded-input font-medium">
              {recipe.cuisine}
            </span>
          )}
          {recipe.course && (
            <span className="bg-cb-green/10 text-cb-green text-sm px-3 py-1.5 rounded-input font-medium">
              {recipe.course}
            </span>
          )}
          {recipe.prep_minutes != null && recipe.prep_minutes > 0 && (
            <span className="bg-cb-card text-cb-muted text-sm px-3 py-1.5 rounded-input border border-cb-border">
              Prep: {formatDuration(recipe.prep_minutes)}
            </span>
          )}
          {recipe.cook_minutes != null && recipe.cook_minutes > 0 && (
            <span className="bg-cb-card text-cb-muted text-sm px-3 py-1.5 rounded-input border border-cb-border">
              Cook: {formatDuration(recipe.cook_minutes)}
            </span>
          )}
          {recipe.total_minutes != null && recipe.total_minutes > 0 && (
            <span className="bg-cb-card text-cb-muted text-sm px-3 py-1.5 rounded-input border border-cb-border">
              Total: {formatDuration(recipe.total_minutes)}
            </span>
          )}
        </div>

        {/* Servings scaler */}
        <div className="bg-cb-card border border-cb-border rounded-card p-5 mb-10 flex items-center gap-6">
          <span className="text-sm font-medium text-cb-muted">Servings</span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setServings((s) => Math.max(1, s - 1))}
              className="w-9 h-9 rounded-full border border-cb-border flex items-center justify-center text-cb-muted hover:border-cb-primary hover:text-cb-primary transition-colors text-lg"
            >
              -
            </button>
            <span className="w-8 text-center font-bold text-lg">{servings}</span>
            <button
              onClick={() => setServings((s) => s + 1)}
              className="w-9 h-9 rounded-full border border-cb-border flex items-center justify-center text-cb-muted hover:border-cb-primary hover:text-cb-primary transition-colors text-lg"
            >
              +
            </button>
          </div>
          {servings !== originalServings && (
            <button
              onClick={() => setServings(originalServings)}
              className="text-xs text-cb-primary font-medium hover:underline"
            >
              Reset to {originalServings}
            </button>
          )}
        </div>

        {/* Two-column layout for ingredients + steps on large screens */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Ingredients */}
          <section className="lg:col-span-1">
            <h2 className="text-xl font-bold mb-4 pb-2 border-b border-cb-border">
              Ingredients
            </h2>
            <ul className="space-y-3">
              {recipe.ingredients.map((ing) => (
                <li key={ing.id} className="flex items-baseline gap-2">
                  <span className="w-2 h-2 rounded-full bg-cb-primary shrink-0 mt-1.5" />
                  <span>
                    <span className="font-medium">
                      {formatQuantity(scaleQuantity(ing.quantity, originalServings, servings))}{' '}
                      {ing.unit ?? ''}
                    </span>{' '}
                    {ing.ingredient}
                    {ing.preparation && (
                      <span className="text-cb-muted">, {ing.preparation}</span>
                    )}
                    {ing.optional && (
                      <span className="text-cb-muted text-xs ml-1">(optional)</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* Steps */}
          <section className="lg:col-span-2">
            <h2 className="text-xl font-bold mb-4 pb-2 border-b border-cb-border">Steps</h2>
            <ol className="space-y-6">
              {recipe.steps.map((step) => (
                <li key={step.id} className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-cb-primary text-white flex items-center justify-center text-sm font-bold shrink-0 mt-0.5">
                    {step.step_number}
                  </div>
                  <div className="flex-1">
                    <p className="leading-relaxed">{step.instruction}</p>
                    {step.timer_minutes && (
                      <div className="inline-flex items-center gap-1.5 mt-2 bg-cb-primary/10 text-cb-primary text-sm px-3 py-1 rounded-input font-medium">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                        </svg>
                        {step.timer_minutes} min
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        {/* Notes */}
        {recipe.notes && (
          <section className="mt-10">
            <h2 className="text-xl font-bold mb-4 pb-2 border-b border-cb-border">Notes</h2>
            <p className="text-cb-muted leading-relaxed">{recipe.notes}</p>
          </section>
        )}

        {/* CTA */}
        <div className="mt-12 bg-cb-card border border-cb-border rounded-card p-10 text-center">
          <h3 className="text-2xl font-bold mb-3">Save this recipe</h3>
          <p className="text-cb-muted mb-6 max-w-md mx-auto">
            Add it to your Chefsbook to scale servings, plan meals around it,
            and auto-generate shopping lists.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link
              href="/dashboard"
              className="bg-cb-green text-white px-8 py-3 rounded-input text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Add to my Chefsbook
            </Link>
            <Link
              href="/"
              className="border border-cb-border px-8 py-3 rounded-input text-sm font-medium text-cb-muted hover:text-cb-text hover:bg-gray-50 transition-colors"
            >
              Learn more
            </Link>
          </div>
        </div>
      </article>

      {/* Footer */}
      <footer className="border-t border-cb-border px-6 py-6 text-center text-cb-muted text-sm">
        <Link href="/" className="font-semibold text-cb-text hover:text-cb-primary">
          Chefsbook
        </Link>{' '}
        — Your recipes, beautifully organised
      </footer>
    </main>
  );
}

function Nav() {
  return (
    <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
      <Link href="/" className="text-xl font-bold">
        <span className="text-cb-primary">Chefs</span>book
      </Link>
      <Link
        href="/dashboard"
        className="bg-cb-primary text-white px-5 py-2 rounded-input text-sm font-semibold hover:opacity-90 transition-opacity"
      >
        Try Chefsbook
      </Link>
    </nav>
  );
}
