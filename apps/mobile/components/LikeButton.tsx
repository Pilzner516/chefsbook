import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useAuthStore } from '../lib/zustand/authStore';
import { toggleLike, isLiked, getLikers } from '@chefsbook/db';
import ChefsDialog from './ChefsDialog';
import { Avatar } from './UIKit';
import { getInitials } from '@chefsbook/ui';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  recipeId: string;
  likeCount: number;
  isOwner?: boolean;
}

export function LikeButton({ recipeId, likeCount: initialCount, isOwner }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const planTier = useAuthStore((s) => s.planTier);

  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(initialCount);
  const [showLikers, setShowLikers] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [likers, setLikers] = useState<{ id: string; username: string | null; display_name: string | null; avatar_url: string | null }[]>([]);

  useEffect(() => {
    if (session?.user?.id) {
      isLiked(recipeId, session.user.id).then(setLiked);
    }
  }, [recipeId, session?.user?.id]);

  useEffect(() => { setCount(initialCount); }, [initialCount]);

  const handleToggle = async () => {
    if (!session?.user?.id) return;
    // Free plan cannot like — show upgrade prompt
    if (planTier === 'free') {
      setShowUpgrade(true);
      return;
    }
    const newLiked = !liked;
    setLiked(newLiked);
    setCount((c) => c + (newLiked ? 1 : -1));
    await toggleLike(recipeId, session.user.id);
  };

  const openLikers = async () => {
    if (!isOwner || count === 0) return;
    const data = await getLikers(recipeId);
    setLikers(data);
    setShowLikers(true);
  };

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <TouchableOpacity onPress={handleToggle} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Ionicons name={liked ? 'heart' : 'heart-outline'} size={22} color={liked ? colors.accent : colors.textMuted} />
      </TouchableOpacity>
      <TouchableOpacity onPress={openLikers} disabled={!isOwner || count === 0}>
        <Text style={{ color: colors.textMuted, fontSize: 13, marginLeft: 4 }}>{count}</Text>
      </TouchableOpacity>

      {/* Likers sheet (owner only) */}
      <Modal visible={showLikers} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.bgScreen, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '60%', paddingBottom: insets.bottom + 16 }}>
            <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 8 }}>
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.borderDefault }} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 }}>
              <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '700' }}>
                {t('likes.likedBy', { count })}
              </Text>
              <TouchableOpacity onPress={() => setShowLikers(false)}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ paddingHorizontal: 20 }}>
              {likers.map((u) => (
                <TouchableOpacity
                  key={u.id}
                  onPress={() => { setShowLikers(false); router.push(`/chef/${u.id}`); }}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}
                >
                  <Avatar uri={u.avatar_url} initials={getInitials(u.display_name)} size={36} />
                  <View style={{ marginLeft: 10, flex: 1 }}>
                    <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '600' }}>@{u.username ?? '?'}</Text>
                    {u.display_name && <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{u.display_name}</Text>}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Upgrade prompt for free plan */}
      <ChefsDialog
        visible={showUpgrade}
        icon="💎"
        title="Upgrade to Like Recipes"
        body="Liking recipes is available on Chef plan and above. Upgrade to interact with the community."
        buttons={[
          { label: 'Maybe Later', variant: 'cancel', onPress: () => setShowUpgrade(false) },
          { label: 'Upgrade', variant: 'primary', onPress: () => { setShowUpgrade(false); router.push('/plans' as any); } },
        ]}
        onClose={() => setShowUpgrade(false)}
      />
    </View>
  );
}
