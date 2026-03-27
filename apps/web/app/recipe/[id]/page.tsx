'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getRecipe } from '@chefsbook/db';
import type { RecipeWithDetails } from '@chefsbook/db';
import { formatDuration, formatQuantity, scaleQuantity } from '@chefsbook/ui';

export default function RecipePage() {
  const { id } = useParams<{ id: string }>();
  const [recipe, setRecipe] = useState<RecipeWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [servings, setServings] = useState<number>(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      const data = await getRecipe(id);
      setRecipe(data);
      if (data) setServings(data.servings);
      setLoading(false);
    })();
  }, [id]);

  const handleShare = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-cb-bg">
        <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
          <Link href="/" className="text-xl font-bold">
            <span className="text-cb-primary">Chefs</span>book
          </Link>
        </nav>
        <div className="text-center text-cb-muted py-20">Loading recipe...</div>
      </main>
    );
  }

  if (!recipe) {
    return (
      <main className="min-h-screen bg-cb-bg">
        <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
          <Link href="/" className="text-xl font-bold">
            <span className="text-cb-primary">Chefs</span>book
          </Link>
        </nav>
        <div className="text-center py-20">
          <h2 className="text-lg font-semibold mb-2">Recipe not found</h2>
          <Link href="/dashboard" className="text-cb-primary text-sm font-medium hover:underline">
            Back to dashboard
          </Link>
        </div>
      </main>
    );
  }

  const originalServings = recipe.servings;

  return (
    <main className="min-h-screen bg-cb-bg">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <Link href="/" className="text-xl font-bold">
          <span className="text-cb-primary">Chefs</span>book
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-cb-muted hover:text-cb-text text-sm font-medium">
            Dashboard
          </Link>
          <button
            onClick={handleShare}
            className="flex items-center gap-2 border border-cb-border px-4 py-2 rounded-input text-sm font-medium hover:bg-cb-card transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" />
            </svg>
            {copied ? 'Copied!' : 'Share'}
          </button>
        </div>
      </nav>

      {/* Hero image */}
      {recipe.image_url && (
        <div className="max-w-4xl mx-auto px-6">
          <div className="h-72 rounded-card overflow-hidden bg-cb-card">
            <img
              src={recipe.image_url}
              alt={recipe.title}
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      )}

      <article className="max-w-4xl mx-auto py-10 px-6">
        {/* Title & meta */}
        <h1 className="text-3xl font-bold mb-4">{recipe.title}</h1>
        {recipe.description && (
          <p className="text-cb-muted text-lg mb-6 leading-relaxed">{recipe.description}</p>
        )}

        <div className="flex flex-wrap gap-3 mb-4">
          {recipe.cuisine && (
            <span className="bg-cb-primary/10 text-cb-primary text-sm px-3 py-1 rounded-input font-medium">
              {recipe.cuisine}
            </span>
          )}
          {recipe.course && (
            <span className="bg-cb-green/10 text-cb-green text-sm px-3 py-1 rounded-input font-medium">
              {recipe.course}
            </span>
          )}
          {recipe.total_minutes != null && recipe.total_minutes > 0 && (
            <span className="bg-cb-card text-cb-muted text-sm px-3 py-1 rounded-input border border-cb-border">
              {formatDuration(recipe.total_minutes)}
            </span>
          )}
          {recipe.tags && recipe.tags.length > 0 && recipe.tags.map((tag) => (
            <span key={tag} className="bg-blue-100 text-blue-700 text-sm px-3 py-1 rounded-input font-medium">
              {tag}
            </span>
          ))}
        </div>

        {recipe.source_url && (
          <div className="mb-8">
            <a
              href={recipe.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-cb-primary hover:underline"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
              View original
            </a>
          </div>
        )}

        {/* Servings scaler */}
        <div className="bg-cb-card border border-cb-border rounded-card p-4 mb-10 inline-flex items-center gap-4">
          <span className="text-sm font-medium text-cb-muted">Servings</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setServings((s) => Math.max(1, s - 1))}
              className="w-8 h-8 rounded-full border border-cb-border flex items-center justify-center text-cb-muted hover:border-cb-primary hover:text-cb-primary transition-colors"
            >
              -
            </button>
            <span className="w-8 text-center font-semibold">{servings}</span>
            <button
              onClick={() => setServings((s) => s + 1)}
              className="w-8 h-8 rounded-full border border-cb-border flex items-center justify-center text-cb-muted hover:border-cb-primary hover:text-cb-primary transition-colors"
            >
              +
            </button>
          </div>
        </div>

        {/* Ingredients */}
        <section className="mb-10">
          <h2 className="text-xl font-bold mb-4 pb-2 border-b border-cb-border">
            Ingredients
          </h2>
          <ul className="space-y-2.5">
            {recipe.ingredients.map((ing) => (
              <li key={ing.id} className="flex items-baseline gap-3">
                <span className="text-cb-primary font-medium min-w-[80px] text-right">
                  {formatQuantity(scaleQuantity(ing.quantity, originalServings, servings))}{' '}
                  {ing.unit ?? ''}
                </span>
                <span>
                  {ing.ingredient}
                  {ing.preparation && (
                    <span className="text-cb-muted">, {ing.preparation}</span>
                  )}
                  {ing.optional && (
                    <span className="text-cb-muted text-sm ml-1">(optional)</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Steps */}
        <section className="mb-10">
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
                    <p className="text-cb-primary text-sm mt-1 font-medium">
                      &#9201; {step.timer_minutes} min
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Notes */}
        {recipe.notes && (
          <section className="mb-10">
            <h2 className="text-xl font-bold mb-4 pb-2 border-b border-cb-border">Notes</h2>
            <p className="text-cb-muted leading-relaxed">{recipe.notes}</p>
          </section>
        )}

        {/* CTA for non-logged-in users */}
        <div className="bg-cb-card border border-cb-border rounded-card p-8 text-center">
          <h3 className="text-lg font-semibold mb-2">Like this recipe?</h3>
          <p className="text-cb-muted text-sm mb-4">
            Save it to your Chefsbook and never lose a recipe again.
          </p>
          <Link
            href="/dashboard"
            className="inline-block bg-cb-green text-white px-6 py-3 rounded-input text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Add to my Chefsbook
          </Link>
        </div>
      </article>
    </main>
  );
}
