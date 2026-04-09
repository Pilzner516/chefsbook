import { getProfileByUsername } from '@chefsbook/db';
import { supabase } from '@chefsbook/db';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import FollowButton from '@/components/FollowButton';
import FollowTabs from '@/components/FollowTabs';

export default async function PublicProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const profile = await getProfileByUsername(username);
  if (!profile) notFound();

  const { data: recipes } = await supabase
    .from('recipes')
    .select('*')
    .eq('user_id', profile.id)
    .eq('visibility', 'public')
    .is('parent_recipe_id', null)
    .order('created_at', { ascending: false });

  return (
    <div className="min-h-screen bg-cb-bg">
      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Profile header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-full bg-cb-primary text-white flex items-center justify-center text-2xl font-bold mx-auto mb-4">
            {profile.display_name?.charAt(0)?.toUpperCase() ?? '?'}
          </div>
          <h1 className="text-2xl font-bold text-cb-text">@{profile.username}</h1>
          {profile.display_name && (
            <p className="text-cb-secondary mt-1">{profile.display_name}</p>
          )}
          {profile.bio && (
            <p className="text-cb-secondary mt-2 max-w-md mx-auto">{profile.bio}</p>
          )}
          <div className="flex justify-center gap-8 mt-4">
            <div className="text-center">
              <div className="text-lg font-bold text-cb-text">{recipes?.length ?? 0}</div>
              <div className="text-xs text-cb-muted">Recipes</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-cb-text">{profile.follower_count ?? 0}</div>
              <div className="text-xs text-cb-muted">Followers</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-cb-text">{profile.following_count ?? 0}</div>
              <div className="text-xs text-cb-muted">Following</div>
            </div>
          </div>
          <FollowButton targetUserId={profile.id} targetUsername={profile.username} />
        </div>

        {/* Public recipes */}
        <h2 className="text-lg font-bold text-cb-text mb-4">Public Recipes</h2>
        {(!recipes || recipes.length === 0) ? (
          <p className="text-cb-muted text-center py-8">No public recipes yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recipes.map((recipe: any) => (
              <Link
                key={recipe.id}
                href={`/recipe/${recipe.id}`}
                className="block bg-cb-card rounded-card p-4 border border-cb-border hover:border-cb-border-strong transition"
              >
                <h3 className="font-semibold text-cb-text">{recipe.title}</h3>
                {recipe.cuisine && (
                  <span className="text-xs text-cb-muted">{recipe.cuisine}</span>
                )}
                {recipe.description && (
                  <p className="text-sm text-cb-secondary mt-1 line-clamp-2">{recipe.description}</p>
                )}
              </Link>
            ))}
          </div>
        )}

        {/* Followers / Following tabs */}
        <FollowTabs userId={profile.id} />
      </div>
    </div>
  );
}
