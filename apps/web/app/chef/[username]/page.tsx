import { supabase } from '@chefsbook/db';
import type { UserProfile, Recipe } from '@chefsbook/db';
import { formatDuration, getInitials } from '@chefsbook/ui';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import FollowButton from '@/components/FollowButton';
import FollowTabs from '@/components/FollowTabs';
import { proxyIfNeeded, CHEFS_HAT_URL } from '@/lib/recipeImage';

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
    .is('parent_recipe_id', null)
    .order('created_at', { ascending: false });

  const publicRecipes = (recipes ?? []) as Recipe[];

  return (
    <main className="min-h-screen bg-cb-bg text-cb-text">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-cb-border">
        <Link href="/" className="text-xl font-bold text-cb-primary">Chefsbook</Link>
        <Link href="/dashboard" className="text-cb-secondary hover:text-cb-text text-sm">Dashboard</Link>
      </nav>

      <div className="max-w-4xl mx-auto py-12 px-6">
        {/* Profile header */}
        <div className="text-center mb-8">
          {chef.avatar_url ? (
            <img src={proxyIfNeeded(chef.avatar_url!)} alt={chef.display_name ?? ''} className="w-20 h-20 rounded-full mx-auto mb-4 object-cover" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-cb-primary mx-auto mb-4 flex items-center justify-center text-white text-2xl font-bold">
              {getInitials(chef.display_name)}
            </div>
          )}
          <h1 className="text-2xl font-bold">{chef.display_name}</h1>
          {chef.username && <p className="text-cb-secondary">@{chef.username}</p>}
          {chef.bio && <p className="text-cb-secondary mt-2 max-w-md mx-auto">{chef.bio}</p>}
          <FollowButton targetUserId={chef.id} targetUsername={chef.username} />
        </div>

        {/* Stats row */}
        <div className="flex justify-center gap-8 mb-8">
          <div className="text-center">
            <p className="text-xl font-bold">{publicRecipes.length}</p>
            <p className="text-cb-secondary text-sm">Recipes</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold">{chef.follower_count ?? 0}</p>
            <p className="text-cb-secondary text-sm">Followers</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold">{chef.following_count ?? 0}</p>
            <p className="text-cb-secondary text-sm">Following</p>
          </div>
        </div>

        {/* Member since */}
        <p className="text-center text-cb-muted text-sm mb-10">
          Member since {new Date(chef.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })}
        </p>

        <h2 className="text-xl font-bold mb-6">Public Recipes ({publicRecipes.length})</h2>
        {publicRecipes.length === 0 ? (
          <p className="text-cb-secondary text-center py-10">No public recipes yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {publicRecipes.map((recipe) => (
              <Link key={recipe.id} href={`/recipe/${recipe.id}`} className="group">
                <div className="bg-cb-card border border-cb-border rounded-card overflow-hidden hover:border-cb-primary/50 transition-colors">
                  {recipe.image_url && (
                    <div className="h-40 overflow-hidden">
                      <img src={proxyIfNeeded(recipe.image_url!)} alt={recipe.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    </div>
                  )}
                  <div className="p-4">
                    <h3 className="font-semibold mb-1 group-hover:text-cb-primary transition-colors">{recipe.title}</h3>
                    <div className="flex items-center gap-2 text-xs text-cb-secondary">
                      {recipe.cuisine && <span className="bg-cb-primary-soft text-cb-primary px-2 py-0.5 rounded">{recipe.cuisine}</span>}
                      {recipe.total_minutes != null && recipe.total_minutes > 0 && <span>{formatDuration(recipe.total_minutes)}</span>}
                    </div>
                    {recipe.attributed_to_username && (
                      <div className="mt-1 text-xs">
                        <span className="bg-cb-base px-1.5 py-0.5 rounded text-cb-secondary">🔗 via @{recipe.attributed_to_username}</span>
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Followers / Following tabs */}
        <FollowTabs userId={chef.id} />
      </div>
    </main>
  );
}
