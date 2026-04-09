import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, TextInput, Modal } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../context/ThemeContext';
import { useAuthStore } from '../../lib/zustand/authStore';
import { supabase, cloneRecipe, updateProfile } from '@chefsbook/db';
import type { UserProfile, Recipe } from '@chefsbook/db';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, RecipeCard, Button, Loading, EmptyState, Input } from '../../components/UIKit';
import { getInitials } from '@chefsbook/ui';

type ProfileTab = 'recipes' | 'about';

export default function ChefProfile() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const loadAuthProfile = useAuthStore((s) => s.loadProfile);
  const [chef, setChef] = useState<UserProfile | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<ProfileTab>('recipes');
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [cloning, setCloning] = useState<string | null>(null);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const isOwnProfile = session?.user?.id === id;

  useEffect(() => {
    if (id) loadChef();
  }, [id]);

  const loadChef = async () => {
    const isOwn = session?.user?.id === id;

    let recipesQuery = supabase
      .from('recipes')
      .select('*')
      .eq('user_id', id!)
      .order('created_at', { ascending: false });

    if (!isOwn) {
      recipesQuery = recipesQuery.eq('visibility', 'public');
    }

    const [{ data: profile }, { data: publicRecipes }, { count: followers }, { count: following }] = await Promise.all([
      supabase.from('user_profiles').select('*').eq('id', id!).single(),
      recipesQuery,
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('followed_id', id!).eq('status', 'accepted'),
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', id!).eq('status', 'accepted'),
    ]);
    setChef(profile as UserProfile | null);
    setRecipes((publicRecipes ?? []) as Recipe[]);
    setFollowerCount(followers ?? 0);
    setFollowingCount(following ?? 0);

    // Check if current user follows this chef
    if (session?.user?.id && session.user.id !== id) {
      const { data: followRow } = await supabase
        .from('follows')
        .select('status')
        .eq('follower_id', session.user.id)
        .eq('followed_id', id!)
        .single();
      setIsFollowing(!!followRow);
    }
    setLoading(false);
  };

  const handleFollow = async () => {
    if (!session?.user?.id || !id) return;
    setFollowLoading(true);
    if (isFollowing) {
      await supabase.from('follows').delete().eq('follower_id', session.user.id).eq('followed_id', id);
      setIsFollowing(false);
      setFollowerCount((c) => Math.max(0, c - 1));
    } else {
      await supabase.from('follows').insert({ follower_id: session.user.id, followed_id: id, status: 'accepted' });
      setIsFollowing(true);
      setFollowerCount((c) => c + 1);
    }
    setFollowLoading(false);
  };

  const handleClone = async (recipeId: string) => {
    if (!session?.user?.id) return;
    setCloning(recipeId);
    try {
      await cloneRecipe(recipeId, session.user.id);
      Alert.alert('Added!', 'Recipe added to your collection.');
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to clone recipe');
    }
    setCloning(null);
  };

  const openEditProfile = () => {
    if (!chef) return;
    setEditDisplayName(chef.display_name ?? '');
    setEditBio(chef.bio ?? '');
    setShowEditProfile(true);
  };

  const saveProfile = async () => {
    if (!chef) return;
    setSavingProfile(true);
    try {
      await updateProfile(chef.id, {
        display_name: editDisplayName.trim() || null,
        bio: editBio.trim() || null,
      });
      await loadChef();
      await loadAuthProfile();
      setShowEditProfile(false);
      Alert.alert(t('profile.profileSaved'));
    } catch (e: any) {
      Alert.alert(t('common.errorTitle'), e.message);
    } finally {
      setSavingProfile(false);
    }
  };

  if (loading) return <Loading message="Loading chef profile..." />;
  if (!chef) return <EmptyState icon="?" title="Chef not found" message="This profile doesn't exist." />;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bgScreen }}>
      {/* Header */}
      <View style={{ alignItems: 'center', padding: 24, paddingBottom: 16 }}>
        <Avatar uri={chef.avatar_url} initials={getInitials(chef.display_name)} size={80} />
        <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: '700', marginTop: 12 }}>
          {chef.display_name}
        </Text>
        {chef.username && (
          <Text style={{ color: colors.textSecondary, fontSize: 15 }}>@{chef.username}</Text>
        )}
        {chef.bio && (
          <Text style={{ color: colors.textSecondary, fontSize: 14, marginTop: 8, textAlign: 'center', paddingHorizontal: 16 }}>{chef.bio}</Text>
        )}

        {/* Stats row */}
        <View style={{ flexDirection: 'row', gap: 24, marginTop: 16 }}>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700' }}>{recipes.length}</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Recipes</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700' }}>{followerCount}</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Followers</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700' }}>{followingCount}</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Following</Text>
          </View>
        </View>

        {/* Follow / Edit Profile button */}
        {isOwnProfile ? (
          <View style={{ marginTop: 12, width: 160 }}>
            <Button title={t('profile.editProfile')} onPress={openEditProfile} variant="secondary" size="sm" />
          </View>
        ) : session?.user ? (
          <View style={{ marginTop: 12, width: 140 }}>
            <Button
              title={followLoading ? '...' : isFollowing ? 'Unfollow' : t('profile.follow')}
              onPress={handleFollow}
              variant={isFollowing ? 'secondary' : 'primary'}
              size="sm"
              disabled={followLoading}
            />
          </View>
        ) : null}
      </View>

      {/* Tab toggle */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 16, marginBottom: 12 }}>
        <TouchableOpacity
          onPress={() => setTab('recipes')}
          style={{
            flex: 1,
            alignItems: 'center',
            paddingVertical: 10,
            borderBottomWidth: 2,
            borderBottomColor: tab === 'recipes' ? colors.accent : colors.borderDefault,
          }}
        >
          <Text style={{ color: tab === 'recipes' ? colors.accent : colors.textSecondary, fontSize: 14, fontWeight: '600' }}>Recipes</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setTab('about')}
          style={{
            flex: 1,
            alignItems: 'center',
            paddingVertical: 10,
            borderBottomWidth: 2,
            borderBottomColor: tab === 'about' ? colors.accent : colors.borderDefault,
          }}
        >
          <Text style={{ color: tab === 'about' ? colors.accent : colors.textSecondary, fontSize: 14, fontWeight: '600' }}>About</Text>
        </TouchableOpacity>
      </View>

      {/* Tab content */}
      <View style={{ padding: 16, paddingTop: 0 }}>
        {tab === 'recipes' && (
          <>
            {recipes.length === 0 ? (
              <EmptyState icon="📖" title="No recipes" message={isOwnProfile ? "You haven't shared any recipes yet." : "This chef hasn't shared any recipes yet."} />
            ) : (
              recipes.map((r) => (
                <View key={r.id}>
                  <RecipeCard
                    title={r.title}
                    imageUrl={r.image_url}
                    cuisine={r.cuisine}
                    totalMinutes={r.total_minutes}
                    isFavourite={r.is_favourite}
                    onPress={() => router.push(`/recipe/${r.id}`)}
                  />
                  {!isOwnProfile && r.user_id !== session?.user?.id && (
                    <TouchableOpacity
                      onPress={() => handleClone(r.id)}
                      disabled={cloning === r.id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: colors.accentGreenSoft,
                        borderRadius: 8,
                        paddingVertical: 8,
                        marginBottom: 12,
                        marginTop: -4,
                        opacity: cloning === r.id ? 0.5 : 1,
                      }}
                    >
                      <Ionicons name="add-circle-outline" size={18} color={colors.accentGreen} />
                      <Text style={{ color: colors.accentGreen, fontSize: 13, fontWeight: '600', marginLeft: 6 }}>
                        {cloning === r.id ? 'Adding...' : 'Add to my collection'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))
            )}
          </>
        )}

        {tab === 'about' && (
          <View>
            <View style={{ backgroundColor: colors.bgCard, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.borderDefault }}>
              <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '600', marginBottom: 8 }}>About {chef.display_name}</Text>
              {chef.bio ? (
                <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 22 }}>{chef.bio}</Text>
              ) : (
                <Text style={{ color: colors.textMuted, fontSize: 14 }}>No bio yet.</Text>
              )}
              <View style={{ marginTop: 16 }}>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                  Member since {new Date(chef.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })}
                </Text>
              </View>
            </View>
          </View>
        )}
      </View>
      <View style={{ height: 32 }} />

      {/* Edit Profile Modal */}
      <Modal visible={showEditProfile} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.bgScreen, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: insets.bottom + 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 }}>
              <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700' }}>{t('profile.editProfile')}</Text>
              <TouchableOpacity onPress={() => setShowEditProfile(false)}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <View style={{ paddingHorizontal: 20 }}>
              {/* Username — read-only */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 4 }}>{t('profile.username')}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgBase, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: colors.borderDefault }}>
                  <Ionicons name="lock-closed" size={16} color={colors.textMuted} style={{ marginRight: 8 }} />
                  <Text style={{ color: colors.textMuted, fontSize: 15 }}>@{chef?.username ?? '—'}</Text>
                </View>
                <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 4 }}>{t('profile.usernameCannotChange')}</Text>
              </View>
              {/* Display name */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 4 }}>{t('profile.displayName')}</Text>
                <Input value={editDisplayName} onChangeText={setEditDisplayName} placeholder={t('profile.displayName')} />
              </View>
              {/* Bio */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 4 }}>{t('profile.bio')}</Text>
                <TextInput
                  value={editBio}
                  onChangeText={(t) => setEditBio(t.slice(0, 200))}
                  placeholder={t('profile.bioPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  multiline
                  maxLength={200}
                  style={{
                    backgroundColor: colors.bgBase, borderRadius: 10, borderWidth: 1, borderColor: colors.borderDefault,
                    padding: 12, paddingBottom: 28, fontSize: 15, color: colors.textPrimary, minHeight: 80, textAlignVertical: 'top',
                  }}
                />
                <Text style={{ position: 'absolute', bottom: 8, right: 12, color: colors.textMuted, fontSize: 11 }}>{editBio.length}/200</Text>
              </View>
              <Button title={t('profile.saveProfile')} onPress={saveProfile} loading={savingProfile} />
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
