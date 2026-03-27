import { getRecipe } from '@chefsbook/db';
import { formatDuration, formatQuantity } from '@chefsbook/ui';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export default async function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const recipe = await getRecipe(id);
  if (!recipe) notFound();

  return (
    <main className="min-h-screen bg-cb-bg text-cb-text">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-cb-border">
        <Link href="/" className="text-xl font-bold text-cb-primary">Chefsbook</Link>
        <Link href="/dashboard" className="text-cb-text-secondary hover:text-cb-text text-sm">Dashboard</Link>
      </nav>

      <article className="max-w-3xl mx-auto py-12 px-6">
        <h1 className="text-3xl font-bold mb-4">{recipe.title}</h1>
        {recipe.description && <p className="text-cb-text-secondary text-lg mb-6">{recipe.description}</p>}

        <div className="flex flex-wrap gap-2 mb-8">
          {recipe.cuisine && (
            <span className="bg-cb-primary/10 text-cb-primary text-sm px-3 py-1 rounded-lg">{recipe.cuisine}</span>
          )}
          {recipe.course && (
            <span className="bg-cb-accent/10 text-cb-accent text-sm px-3 py-1 rounded-lg">{recipe.course}</span>
          )}
          {recipe.total_minutes != null && recipe.total_minutes > 0 && (
            <span className="bg-cb-surface text-cb-text-secondary text-sm px-3 py-1 rounded-lg border border-cb-border">
              {formatDuration(recipe.total_minutes)}
            </span>
          )}
          <span className="bg-cb-surface text-cb-text-secondary text-sm px-3 py-1 rounded-lg border border-cb-border">
            {recipe.servings} servings
          </span>
        </div>

        <section className="mb-10">
          <h2 className="text-xl font-bold mb-4 border-b border-cb-border pb-2">Ingredients</h2>
          <ul className="space-y-2">
            {recipe.ingredients.map((ing) => (
              <li key={ing.id} className="flex items-baseline gap-3">
                <span className="text-cb-primary font-medium min-w-[80px] text-right">
                  {formatQuantity(ing.quantity)} {ing.unit ?? ''}
                </span>
                <span>
                  {ing.ingredient}
                  {ing.preparation && <span className="text-cb-text-secondary">, {ing.preparation}</span>}
                  {ing.optional && <span className="text-cb-text-tertiary text-sm ml-1">(optional)</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-bold mb-4 border-b border-cb-border pb-2">Steps</h2>
          <ol className="space-y-6">
            {recipe.steps.map((step) => (
              <li key={step.id} className="flex gap-4">
                <div className="w-7 h-7 rounded-full bg-cb-primary text-cb-bg flex items-center justify-center text-sm font-bold shrink-0 mt-0.5">
                  {step.step_number}
                </div>
                <div className="flex-1">
                  <p className="leading-relaxed">{step.instruction}</p>
                  {step.timer_minutes && (
                    <p className="text-cb-primary text-sm mt-1">{'\u23F1'} {step.timer_minutes} min</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>

        {recipe.notes && (
          <section className="mb-10">
            <h2 className="text-xl font-bold mb-4 border-b border-cb-border pb-2">Notes</h2>
            <p className="text-cb-text-secondary leading-relaxed">{recipe.notes}</p>
          </section>
        )}
      </article>
    </main>
  );
}
