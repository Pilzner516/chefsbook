'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@chefsbook/db';
import type { Recipe } from '@chefsbook/db';
import FollowButton from '@/components/FollowButton';
import MessageButton from '@/components/MessageButton';
import FollowTabs from '@/components/FollowTabs';
import { proxyIfNeeded, CHEFS_HAT_URL } from '@/lib/recipeImage';

interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  follower_count: number;
  following_count: number;
}

export default function DashboardChefPage() {
  const params = useParams<{ username: string }>();
  const username = params.username;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!username) return;
    (async () => {
      const { data: p } = await supabase
        .from('user_profiles')
        .select('id, username, display_name, avatar_url, bio, follower_count, following_count')
        .eq('username', username)
        .single();

      if (!p) { setNotFound(true); setLoading(false); return; }
      setProfile(p as Profile);

      const { data: r } = await supabase
        .from('recipes')
        .select('*')
        .eq('user_id', p.id)
        .in('visibility', ['public', 'shared_link'])
        .is('parent_recipe_id', null)
        .order('created_at', { ascending: false });
      setRecipes((r ?? []) as Recipe[]);
      setLoading(false);
    })();
  }, [username]);

  if (loading) return <div className="p-8 text-cb-secondary">Loading profile...</div>;
  if (notFound) return <div className="p-8 text-cb-muted">Profile not found.</div>;
  if (!profile) return null;

  return (
    <div className="p-8 max-w-3xl mx-auto">
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
            <div className="text-lg font-bold text-cb-text">{recipes.length}</div>
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
        <div className="flex items-center justify-center gap-2 mt-4">
          <FollowButton targetUserId={profile.id} targetUsername={profile.username} />
          <MessageButton targetUserId={profile.id} targetUsername={profile.username} />
        </div>
      </div>

      {/* Public recipes */}
      <h2 className="text-lg font-bold text-cb-text mb-4">Public Recipes</h2>
      {recipes.length === 0 ? (
        <p className="text-cb-muted text-center py-8">No public recipes yet.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {recipes.map((recipe) => (
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
  );
}
