import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, TextInput, Modal, FlatList } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../context/ThemeContext';
import { useAuthStore } from '../../lib/zustand/authStore';
import {
  supabase, saveRecipe, updateProfile, getProfileById,
  followUser, unfollowUser, isFollowing as checkIsFollowing,
  getFollowers, getFollowing, getFollowedRecipes, sendMessage,
  canDo, getUserPlanTier,
} from '@chefsbook/db';
import type { UserProfile, Recipe, PlanTier } from '@chefsbook/db';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, RecipeCard, Button, Loading, EmptyState, Input } from '../../components/UIKit';
import ChefsDialog from '../../components/ChefsDialog';
import { getInitials } from '@chefsbook/ui';

type ProfileTab = 'recipes' | 'followers' | 'following';

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
  const [isFollowingUser, setIsFollowingUser] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [cloning, setCloning] = useState<string | null>(null);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [followers, setFollowers] = useState<UserProfile[]>([]);
  const [following, setFollowing] = useState<UserProfile[]>([]);
  const [showMessageSheet, setShowMessageSheet] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [messageSending, setMessageSending] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [followersLoading, setFollowersLoading] = useState(false);
  const [userPlanTier, setUserPlanTier] = useState<PlanTier>('free');
  const [showUnfollowDialog, setShowUnfollowDialog] = useState(false);

  const isOwnProfile = session?.user?.id === id;

  useEffect(() => {
    if (id) loadChef();
  }, [id]);

  useEffect(() => {
    if (session?.user?.id) {
      getUserPlanTier(session.user.id).then(setUserPlanTier);
    }
  }, [session?.user?.id]);

  const loadChef = async () => {
    const isOwn = session?.user?.id === id;

    let recipesQuery = supabase
      .from('recipes')
      .select('*')
      .eq('user_id', id!)
      .is('parent_recipe_id', null)
      .order('created_at', { ascending: false });

    if (!isOwn) {
      recipesQuery = recipesQuery.in('visibility', ['public', 'shared_link']);
    }

    const [profile, { data: publicRecipes }] = await Promise.all([
      getProfileById(id!),
      recipesQuery,
    ]);
    setChef(profile);
    setRecipes((publicRecipes ?? []) as Recipe[]);
    setFollowerCount(profile?.follower_count ?? 0);
    setFollowingCount(profile?.following_count ?? 0);

    // Check if current user follows this chef
    if (session?.user?.id && session.user.id !== id) {
      const following = await checkIsFollowing(session.user.id, id!);
      setIsFollowingUser(following);
    }
    setLoading(false);
  };

  const handleFollow = async () => {
    if (!session?.user?.id || !id) return;

    // Plan gate
    if (!canDo(userPlanTier, 'canFollow')) {
      Alert.alert(
        t('follow.planRequired'),
        t('follow.planRequiredMessage'),
      );
      return;
    }

    if (isFollowingUser) {
      setShowUnfollowDialog(true);
      return;
    }

    // Follow — optimistic update
    setFollowLoading(true);
    setIsFollowingUser(true);
    setFollowerCount((c) => c + 1);
    try {
      await followUser(session.user.id, id);
    } catch {
      setIsFollowingUser(false);
      setFollowerCount((c) => Math.max(0, c - 1));
    }
    setFollowLoading(false);
  };

  const loadFollowers = async () => {
    if (!id) return;
    setFollowersLoading(true);
    const data = await getFollowers(id);
    setFollowers(data);
    setFollowersLoading(false);
  };

  const loadFollowing = async () => {
    if (!id) return;
    setFollowersLoading(true);
    const data = await getFollowing(id);
    setFollowing(data);
    setFollowersLoading(false);
  };

  useEffect(() => {
    if (tab === 'followers') loadFollowers();
    if (tab === 'following') loadFollowing();
  }, [tab]);

  const handleClone = async (recipeId: string) => {
    if (!session?.user?.id) return;
    setCloning(recipeId);
    try {
      await saveRecipe(recipeId, session.user.id);
      Alert.alert('Added!', 'Recipe saved to your collection.');
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

  const canFollow = canDo(userPlanTier, 'canFollow');

  const renderUserRow = (user: UserProfile) => (
    <TouchableOpacity
      key={user.id}
      onPress={() => router.push(`/chef/${user.id}`)}
      style={{
        flexDirection: 'row', alignItems: 'center', padding: 12, marginBottom: 6,
        backgroundColor: colors.bgCard, borderRadius: 12, borderWidth: 1, borderColor: colors.borderDefault,
      }}
    >
      <Avatar uri={user.avatar_url} initials={getInitials(user.display_name)} size={44} />
      <View style={{ marginLeft: 12, flex: 1 }}>
        {user.username && (
          <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '600' }}>@{user.username}</Text>
        )}
        {user.display_name && (
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{user.display_name}</Text>
        )}
      </View>
      <Text style={{ color: colors.textMuted, fontSize: 12 }}>
        {user.follower_count} {t('follow.followers').toLowerCase()}
      </Text>
    </TouchableOpacity>
  );

  if (loading) return <Loading message={t('common.loading')} />;
  if (!chef) return <EmptyState icon="?" title={t('profile.notFound')} message={t('profile.notFoundMessage')} />;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bgScreen }} contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}>
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
          <TouchableOpacity onPress={() => setTab('recipes')} style={{ alignItems: 'center' }}>
            <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700' }}>{recipes.length}</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{t('follow.recipes')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setTab('followers')} style={{ alignItems: 'center' }}>
            <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700' }}>{followerCount}</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{t('follow.followers')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setTab('following')} style={{ alignItems: 'center' }}>
            <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700' }}>{followingCount}</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{t('follow.following')}</Text>
          </TouchableOpacity>
        </View>

        {/* Follow / Edit Profile button */}
        {isOwnProfile ? (
          <View style={{ marginTop: 12, width: 160 }}>
            <Button title={t('profile.editProfile')} onPress={openEditProfile} variant="secondary" size="sm" />
          </View>
        ) : session?.user ? (
          <View style={{ marginTop: 12, width: 200 }}>
            {canFollow ? (
              <Button
                title={followLoading ? '...' : isFollowingUser ? `${t('follow.followingLabel')} ✓` : `${t('follow.follow')} +`}
                onPress={handleFollow}
                variant={isFollowingUser ? 'secondary' : 'primary'}
                size="sm"
                disabled={followLoading}
              />
            ) : (
              <Button
                title={`🔒 ${t('follow.planRequired')}`}
                onPress={() => Alert.alert(t('follow.planRequired'), t('follow.planRequiredMessage'))}
                variant="secondary"
                size="sm"
              />
            )}
            <View style={{ marginTop: 8 }}>
              <Button
                title="Message"
                onPress={() => { setMessageText(''); setMessageError(null); setShowMessageSheet(true); }}
                variant="secondary"
                size="sm"
              />
            </View>
          </View>
        ) : null}
      </View>

      {/* Tab toggle */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 16, marginBottom: 12 }}>
        {(['recipes', 'followers', 'following'] as ProfileTab[]).map((tabKey) => (
          <TouchableOpacity
            key={tabKey}
            onPress={() => setTab(tabKey)}
            style={{
              flex: 1,
              alignItems: 'center',
              paddingVertical: 10,
              borderBottomWidth: 2,
              borderBottomColor: tab === tabKey ? colors.accent : colors.borderDefault,
            }}
          >
            <Text style={{ color: tab === tabKey ? colors.accent : colors.textSecondary, fontSize: 14, fontWeight: '600' }}>
              {t(`follow.${tabKey}`)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab content */}
      <View style={{ padding: 16, paddingTop: 0 }}>
        {tab === 'recipes' && (
          <>
            {recipes.length === 0 ? (
              <EmptyState icon="📖" title={t('follow.noRecipes')} message={isOwnProfile ? t('follow.noRecipesOwn') : t('follow.noRecipesOther')} />
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
                        {cloning === r.id ? t('search.adding') : t('search.addToCollection')}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))
            )}
          </>
        )}

        {tab === 'followers' && (
          followersLoading ? (
            <Loading message={t('common.loading')} />
          ) : followers.length === 0 ? (
            <EmptyState icon="👥" title={t('follow.noFollowers')} message={t('follow.noFollowersMessage')} />
          ) : (
            followers.map(renderUserRow)
          )
        )}

        {tab === 'following' && (
          followersLoading ? (
            <Loading message={t('common.loading')} />
          ) : following.length === 0 ? (
            <EmptyState icon="👥" title={t('follow.noFollowing')} message={t('follow.noFollowingMessage')} />
          ) : (
            following.map(renderUserRow)
          )
        )}
      </View>

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
                  onChangeText={(v) => setEditBio(v.slice(0, 200))}
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
      <ChefsDialog
        visible={showUnfollowDialog}
        title={t('follow.unfollowConfirmTitle')}
        body={t('follow.unfollowConfirmMessage', { username: chef?.username ?? chef?.display_name })}
        onClose={() => setShowUnfollowDialog(false)}
        buttons={[
          { label: t('common.cancel'), variant: 'cancel', onPress: () => setShowUnfollowDialog(false) },
          { label: t('follow.unfollow'), variant: 'secondary', onPress: async () => {
            setShowUnfollowDialog(false);
            setFollowLoading(true);
            setIsFollowingUser(false);
            setFollowerCount((c) => Math.max(0, c - 1));
            try {
              await unfollowUser(session!.user.id, id!);
            } catch {
              setIsFollowingUser(true);
              setFollowerCount((c) => c + 1);
            }
            setFollowLoading(false);
          }},
        ]}
      />
      {/* Message compose sheet */}
      {showMessageSheet && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.bgCard, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: insets.bottom + 20 }}>
            <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '700', marginBottom: 4 }}>Message @{chef?.username ?? ''}</Text>
            {messageError && <Text style={{ color: colors.danger, fontSize: 13, marginBottom: 8 }}>{messageError}</Text>}
            <TextInput
              value={messageText}
              onChangeText={(t) => setMessageText(t.slice(0, 1000))}
              placeholder="Write a message..."
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={1000}
              autoFocus
              style={{ backgroundColor: colors.bgBase, borderRadius: 12, padding: 14, fontSize: 15, color: colors.textPrimary, borderWidth: 1, borderColor: colors.borderDefault, minHeight: 100, textAlignVertical: 'top', marginBottom: 4 }}
            />
            <Text style={{ color: colors.textMuted, fontSize: 11, textAlign: 'right', marginBottom: 12 }}>{messageText.length}/1000</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                onPress={() => setShowMessageSheet(false)}
                style={{ flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.borderDefault }}
              >
                <Text style={{ color: colors.textSecondary, fontWeight: '600', fontSize: 14 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  if (!messageText.trim() || !session?.user?.id || !id) return;
                  setMessageSending(true);
                  setMessageError(null);
                  try {
                    await sendMessage(session.user.id, id, messageText.trim());
                    setShowMessageSheet(false);
                    Alert.alert('Message sent!');
                  } catch (e: any) {
                    setMessageError(e.message ?? 'Failed to send');
                  }
                  setMessageSending(false);
                }}
                disabled={messageSending || messageText.trim().length < 1}
                style={{ flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 10, backgroundColor: messageText.trim().length < 1 ? colors.bgBase : colors.accent, opacity: messageSending ? 0.5 : 1 }}
              >
                <Text style={{ color: messageText.trim().length < 1 ? colors.textMuted : '#ffffff', fontWeight: '600', fontSize: 14 }}>
                  {messageSending ? 'Sending...' : 'Send'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
}
