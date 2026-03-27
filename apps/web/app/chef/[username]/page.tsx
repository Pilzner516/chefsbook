import { supabase } from '@chefsbook/db';
import type { UserProfile, Recipe } from '@chefsbook/db';
import { formatDuration, getInitials } from '@chefsbook/ui';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export default async function ChefPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('username', username)
    .single();

  if (!profile) notFound();

  const chef = profile as UserProfile;

  const { data: recipes } = await supabase
    .from('recipes')
    .select('*')
    .eq('user_id', chef.id)
    .eq('visibility', 'public')
    .order('created_at', { ascending: false });

  const publicRecipes = (recipes ?? []) as Recipe[];

  return (
    <main className="min-h-screen bg-cb-bg text-cb-text">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-cb-border">
        <Link href="/" className="text-xl font-bold text-cb-primary">Chefsbook</Link>
        <Link href="/dashboard" className="text-cb-text-secondary hover:text-cb-text text-sm">Dashboard</Link>
      </nav>

      <div className="max-w-4xl mx-auto py-12 px-6">
        <div className="text-center mb-12">
          {chef.avatar_url ? (
            <img src={chef.avatar_url} alt={chef.display_name ?? ''} className="w-20 h-20 rounded-full mx-auto mb-4 object-cover" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-cb-primary mx-auto mb-4 flex items-center justify-center text-cb-bg text-2xl font-bold">
              {getInitials(chef.display_name)}
            </div>
          )}
          <h1 className="text-2xl font-bold">{chef.display_name}</h1>
          {chef.username && <p className="text-cb-text-secondary">@{chef.username}</p>}
          {chef.bio && <p className="text-cb-text-secondary mt-2 max-w-md mx-auto">{chef.bio}</p>}
        </div>

        <h2 className="text-xl font-bold mb-6">Public Recipes ({publicRecipes.length})</h2>
        {publicRecipes.length === 0 ? (
          <p className="text-cb-text-secondary text-center py-10">No public recipes yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {publicRecipes.map((recipe) => (
              <Link key={recipe.id} href={`/recipe/${recipe.id}`} className="group">
                <div className="bg-cb-surface border border-cb-border rounded-xl overflow-hidden hover:border-cb-primary/50 transition-colors">
                  {recipe.image_url && (
                    <div className="h-40 overflow-hidden">
                      <img src={recipe.image_url} alt={recipe.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    </div>
                  )}
                  <div className="p-4">
                    <h3 className="font-semibold mb-1 group-hover:text-cb-primary transition-colors">{recipe.title}</h3>
                    <div className="flex items-center gap-2 text-xs text-cb-text-secondary">
                      {recipe.cuisine && <span className="bg-cb-primary/10 text-cb-primary px-2 py-0.5 rounded">{recipe.cuisine}</span>}
                      {recipe.total_minutes != null && recipe.total_minutes > 0 && <span>{formatDuration(recipe.total_minutes)}</span>}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
