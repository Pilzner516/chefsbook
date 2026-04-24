'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '@chefsbook/db';
import type { Recipe, Technique, Cookbook } from '@chefsbook/db';
import { formatDuration, getInitials } from '@chefsbook/ui';
import FollowButton from '@/components/FollowButton';
import MessageButton from '@/components/MessageButton';
import FollowTabs from '@/components/FollowTabs';
import UserBadges from '@/components/UserBadges';
import { proxyIfNeeded, CHEFS_HAT_URL, getRecipeImageUrl } from '@/lib/recipeImage';

interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  location: string | null;
  instagram_url: string | null;
  website_url: string | null;
  plan_tier: string;
  follower_count: number;
  following_count: number;
  created_at: string;
  account_status: string;
}

interface PrimaryPhoto {
  recipe_id: string;
  url: string;
}

type TabId = 'recipes' | 'techniques' | 'cookbooks' | 'about';

const PLAN_BADGES: Record<string, { label: string; color: string } | null> = {
  free: null,
  chef: { label: 'Chef', color: 'bg-gray-100 text-gray-600' },
  family: { label: 'Family', color: 'bg-gray-100 text-gray-600' },
  pro: { label: 'Pro', color: 'bg-amber-100 text-amber-700' },
};

export default function ChefPage() {
  const params = useParams<{ username: string }>();
  const username = params.username;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [techniques, setTechniques] = useState<Technique[]>([]);
  const [cookbooks, setCookbooks] = useState<Cookbook[]>([]);
  const [primaryPhotos, setPrimaryPhotos] = useState<Map<string, string>>(new Map());
  const [totalLikes, setTotalLikes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('recipes');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [visibleRecipes, setVisibleRecipes] = useState(12);
  const [publicRecipeCount, setPublicRecipeCount] = useState(0);
  const [privateRecipeCount, setPrivateRecipeCount] = useState(0);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setCurrentUserId(data.session?.user?.id ?? null);
      setAuthChecked(true);
    });
  }, []);

  useEffect(() => {
    if (!username || !authChecked) return;
    (async () => {
      // Fetch profile
      const { data: p } = await supabase
        .from('user_profiles')
        .select('id, username, display_name, avatar_url, bio, location, instagram_url, website_url, plan_tier, follower_count, following_count, created_at, account_status')
        .eq('username', username)
        .single();

      if (!p) { setNotFound(true); setLoading(false); return; }
      if (p.account_status === 'expelled') { setNotFound(true); setLoading(false); return; }
      setProfile(p as Profile);

      const isOwnProfile = currentUserId === p.id;

      // Fetch user tags
      const { data: userTags } = await supabase
        .from('user_account_tags')
        .select('tag')
        .eq('user_id', p.id);
      setTags((userTags ?? []).map((t: { tag: string }) => t.tag));

      // Fetch recipes - all if own profile, public only if viewing another user
      let recipeQuery = supabase
        .from('recipes')
        .select('*')
        .eq('user_id', p.id)
        .is('parent_recipe_id', null)
        .is('duplicate_of', null)
        .order('created_at', { ascending: false });

      if (!isOwnProfile) {
        recipeQuery = recipeQuery.in('visibility', ['public', 'shared_link']);
      }

      const { data: r } = await recipeQuery;
      const recipeList = (r ?? []) as Recipe[];
      setRecipes(recipeList);

      // Calculate public/private counts for own profile
      if (isOwnProfile) {
        const publicCount = recipeList.filter(rec => rec.visibility === 'public' || rec.visibility === 'shared_link').length;
        const privateCount = recipeList.filter(rec => rec.visibility === 'private' || rec.visibility === 'friends').length;
        setPublicRecipeCount(publicCount);
        setPrivateRecipeCount(privateCount);
      } else {
        setPublicRecipeCount(recipeList.length);
        setPrivateRecipeCount(0);
      }

      // Fetch primary photos for recipes
      if (recipeList.length > 0) {
        const recipeIds = recipeList.map((rec) => rec.id);
        const { data: photos } = await supabase
          .from('recipe_user_photos')
          .select('recipe_id, url')
          .in('recipe_id', recipeIds)
          .eq('is_primary', true);
        const photoMap = new Map<string, string>();
        (photos ?? []).forEach((photo: PrimaryPhoto) => {
          photoMap.set(photo.recipe_id, photo.url);
        });
        setPrimaryPhotos(photoMap);
      }

      // Fetch total likes
      const { data: likesData } = await supabase
        .from('recipes')
        .select('like_count')
        .eq('user_id', p.id)
        .in('visibility', ['public', 'shared_link']);
      const total = (likesData ?? []).reduce((sum: number, r: { like_count: number | null }) => sum + (r.like_count ?? 0), 0);
      setTotalLikes(total);

      // Fetch techniques - all if own profile, public only if viewing another user
      let techQuery = supabase
        .from('techniques')
        .select('*')
        .eq('user_id', p.id)
        .order('created_at', { ascending: false });

      if (!isOwnProfile) {
        techQuery = techQuery.in('visibility', ['public', 'shared_link']);
      }

      const { data: tech } = await techQuery;
      setTechniques((tech ?? []) as Technique[]);

      // Fetch cookbooks - all if own profile, public only if viewing another user
      let cbQuery = supabase
        .from('cookbooks')
        .select('*')
        .eq('user_id', p.id)
        .order('created_at', { ascending: false });

      if (!isOwnProfile) {
        cbQuery = cbQuery.eq('visibility', 'public');
      }

      const { data: cb } = await cbQuery;
      setCookbooks((cb ?? []) as Cookbook[]);

      setLoading(false);
    })();
  }, [username, authChecked, currentUserId]);

  if (loading) return <div className="min-h-screen bg-cb-bg flex items-center justify-center text-cb-secondary">Loading profile...</div>;
  if (notFound) return <div className="min-h-screen bg-cb-bg flex items-center justify-center text-cb-muted">Profile not found.</div>;
  if (!profile) return null;

  const isOwnProfile = currentUserId === profile.id;
  const planBadge = PLAN_BADGES[profile.plan_tier];

  // Helper to format Instagram URL
  const formatInstagram = (url: string) => {
    if (url.startsWith('http')) return url;
    if (url.startsWith('@')) return `https://instagram.com/${url.slice(1)}`;
    return `https://instagram.com/${url}`;
  };

  // Helper to format website URL
  const formatWebsite = (url: string) => {
    if (url.startsWith('http')) return url;
    return `https://${url}`;
  };

  // Get top cuisines from recipes
  const cuisineCounts = recipes.reduce((acc, r) => {
    if (r.cuisine) acc[r.cuisine] = (acc[r.cuisine] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const topCuisines = Object.entries(cuisineCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([cuisine]) => cuisine);

  return (
    <main className="min-h-screen bg-cb-bg text-cb-text">
      {/* Navigation */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-cb-border bg-cb-card">
        <Link href="/" className="text-xl font-bold"><span className="text-cb-primary">Chefs</span>book</Link>
        <Link href="/dashboard" className="text-cb-secondary hover:text-cb-text text-sm">Dashboard</Link>
      </nav>

      <div className="max-w-4xl mx-auto py-12 px-6">
        {/* Profile header */}
        <div className="text-center mb-8">
          {/* Avatar */}
          {profile.avatar_url ? (
            <img src={proxyIfNeeded(profile.avatar_url)} alt={profile.display_name ?? ''} className="w-24 h-24 rounded-full mx-auto mb-4 object-cover border-2 border-cb-border" />
          ) : (
            <div className="w-24 h-24 rounded-full bg-cb-primary mx-auto mb-4 flex items-center justify-center text-white text-3xl font-bold">
              {getInitials(profile.display_name ?? profile.username)}
            </div>
          )}

          {/* Username + badges */}
          <div className="flex items-center justify-center gap-2 mb-1">
            <h1 className="text-xl font-bold text-cb-text">@{profile.username}</h1>
            <UserBadges tags={tags} createdAt={profile.created_at} size="lg" />
          </div>

          {/* Verified Member · Since [Month Year] */}
          {tags.includes('Verified Chef') && (
            <p className="text-sm text-cb-muted mb-1">
              Verified Member · Since {new Date(profile.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })}
            </p>
          )}

          {/* Display name */}
          {profile.display_name && (
            <p className="text-lg text-cb-text">{profile.display_name}</p>
          )}

          {/* Plan badge */}
          {planBadge && (
            <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${planBadge.color}`}>
              {planBadge.label}
            </span>
          )}

          {/* Bio */}
          {profile.bio && (
            <p className="text-cb-secondary mt-3 max-w-md mx-auto">{profile.bio}</p>
          )}

          {/* Location + social links */}
          <div className="flex items-center justify-center gap-4 mt-3 text-sm text-cb-secondary">
            {profile.location && (
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" /></svg>
                {profile.location}
              </span>
            )}
            {profile.instagram_url && (
              <a href={formatInstagram(profile.instagram_url)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-cb-primary">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
              </a>
            )}
            {profile.website_url && (
              <a href={formatWebsite(profile.website_url)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-cb-primary">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" /></svg>
                Website
              </a>
            )}
          </div>

          {/* Stats row */}
          <div className="flex justify-center gap-8 mt-6">
            <div className="text-center">
              <p className="text-xl font-bold">{recipes.length}</p>
              <p className="text-cb-secondary text-sm">Recipes</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold">{profile.follower_count ?? 0}</p>
              <p className="text-cb-secondary text-sm">Followers</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold">{profile.following_count ?? 0}</p>
              <p className="text-cb-secondary text-sm">Following</p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-center gap-2 mt-6">
            {isOwnProfile ? (
              <Link href="/dashboard/settings" className="bg-cb-primary text-white px-6 py-2 rounded-input text-sm font-semibold hover:opacity-90">
                Edit Profile
              </Link>
            ) : (
              <>
                <FollowButton targetUserId={profile.id} targetUsername={profile.username} />
                <MessageButton targetUserId={profile.id} targetUsername={profile.username} />
              </>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-cb-border mb-6">
          {(['recipes', 'techniques', 'cookbooks', 'about'] as TabId[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'text-cb-primary border-b-2 border-cb-primary -mb-px'
                  : 'text-cb-secondary hover:text-cb-text'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === 'recipes' && recipes.length > 0 && (
                <span className="ml-1 text-cb-muted">
                  ({isOwnProfile && privateRecipeCount > 0
                    ? `${publicRecipeCount} public · ${privateRecipeCount} private`
                    : recipes.length})
                </span>
              )}
              {tab === 'techniques' && techniques.length > 0 && <span className="ml-1 text-cb-muted">({techniques.length})</span>}
              {tab === 'cookbooks' && cookbooks.length > 0 && <span className="ml-1 text-cb-muted">({cookbooks.length})</span>}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'recipes' && (
          <div>
            {recipes.length === 0 ? (
              <p className="text-cb-muted text-center py-12">{isOwnProfile ? 'No recipes yet.' : 'No public recipes yet.'}</p>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {recipes.slice(0, visibleRecipes).map((recipe) => {
                    const primaryPhoto = primaryPhotos.get(recipe.id);
                    const imageUrl = getRecipeImageUrl(primaryPhoto, recipe.image_url, recipe.youtube_video_id);
                    return (
                      <Link key={recipe.id} href={`/recipe/${recipe.id}`} className="group">
                        <div className="bg-cb-card border border-cb-border rounded-card overflow-hidden hover:border-cb-primary/50 transition-colors">
                          <div className="h-40 overflow-hidden bg-cb-bg">
                            <img
                              src={imageUrl ? proxyIfNeeded(imageUrl) : CHEFS_HAT_URL}
                              alt={recipe.title}
                              className={`w-full h-full object-cover group-hover:scale-105 transition-transform ${!imageUrl ? 'p-8 opacity-30' : ''}`}
                            />
                          </div>
                          <div className="p-4">
                            <h3 className="font-semibold mb-1 group-hover:text-cb-primary transition-colors line-clamp-1">{recipe.title}</h3>
                            <div className="flex items-center gap-2 text-xs text-cb-secondary">
                              {recipe.cuisine && <span className="bg-cb-primary-soft text-cb-primary px-2 py-0.5 rounded">{recipe.cuisine}</span>}
                              {recipe.total_minutes != null && recipe.total_minutes > 0 && <span>{formatDuration(recipe.total_minutes)}</span>}
                              {(recipe.like_count ?? 0) > 0 && <span className="text-cb-muted">♥ {recipe.like_count}</span>}
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
                {visibleRecipes < recipes.length && (
                  <div className="text-center mt-8">
                    <button
                      onClick={() => setVisibleRecipes((v) => v + 12)}
                      className="text-cb-primary hover:underline text-sm font-medium"
                    >
                      Load more recipes
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'techniques' && (
          <div>
            {techniques.length === 0 ? (
              <p className="text-cb-muted text-center py-12">No public techniques yet.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {techniques.map((tech) => (
                  <Link key={tech.id} href={`/technique/${tech.id}`} className="group">
                    <div className="bg-cb-card border border-cb-border rounded-card overflow-hidden hover:border-cb-primary/50 transition-colors">
                      {tech.youtube_video_id && (
                        <div className="h-32 overflow-hidden">
                          <img
                            src={`https://img.youtube.com/vi/${tech.youtube_video_id}/mqdefault.jpg`}
                            alt={tech.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <div className="p-4">
                        <h3 className="font-semibold mb-1 group-hover:text-cb-primary transition-colors">{tech.title}</h3>
                        <div className="flex items-center gap-2 text-xs text-cb-secondary">
                          {tech.difficulty && <span className="bg-cb-green-soft text-cb-green px-2 py-0.5 rounded">{tech.difficulty}</span>}
                        </div>
                        {tech.description && (
                          <p className="text-sm text-cb-secondary mt-2 line-clamp-2">{tech.description}</p>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'cookbooks' && (
          <div>
            {cookbooks.length === 0 ? (
              <p className="text-cb-muted text-center py-12">No public cookbooks yet.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {cookbooks.map((cb) => (
                  <Link key={cb.id} href={`/dashboard/cookbooks/${cb.id}`} className="group">
                    <div className="bg-cb-card border border-cb-border rounded-card overflow-hidden hover:border-cb-primary/50 transition-colors">
                      {cb.cover_url && (
                        <div className="h-40 overflow-hidden">
                          <img src={proxyIfNeeded(cb.cover_url)} alt={cb.title} className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div className="p-4">
                        <h3 className="font-semibold mb-1 group-hover:text-cb-primary transition-colors">{cb.title}</h3>
                        {cb.description && (
                          <p className="text-sm text-cb-secondary line-clamp-2">{cb.description}</p>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'about' && (
          <div className="bg-cb-card border border-cb-border rounded-card p-6">
            {/* Full bio */}
            {profile.bio && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-cb-secondary mb-2">About</h3>
                <p className="text-cb-text">{profile.bio}</p>
              </div>
            )}

            {/* Member since */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-cb-secondary mb-2">Member since</h3>
              <p className="text-cb-text">{new Date(profile.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>

            {/* Cuisine specialties */}
            {topCuisines.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-cb-secondary mb-2">Cuisine specialties</h3>
                <div className="flex flex-wrap gap-2">
                  {topCuisines.map((c) => (
                    <span key={c} className="bg-cb-primary-soft text-cb-primary px-3 py-1 rounded-full text-sm">{c}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Stats */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-cb-secondary mb-2">Stats</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-cb-bg rounded-input p-3">
                  <p className="text-2xl font-bold text-cb-text">{totalLikes}</p>
                  <p className="text-xs text-cb-muted">Total likes received</p>
                </div>
                <div className="bg-cb-bg rounded-input p-3">
                  <p className="text-2xl font-bold text-cb-text">{recipes.length + techniques.length}</p>
                  <p className="text-xs text-cb-muted">Total content shared</p>
                </div>
              </div>
            </div>

            {/* Badges earned */}
            {tags.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-cb-secondary mb-2">Badges earned</h3>
                <UserBadges tags={tags} createdAt={profile.created_at} size="lg" />
              </div>
            )}
          </div>
        )}

        {/* Followers / Following tabs */}
        <div className="mt-10">
          <FollowTabs userId={profile.id} />
        </div>
      </div>
    </main>
  );
}
