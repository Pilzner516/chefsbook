import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  ScrollView,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  supabase,
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  getVerifiedUserIds,
} from '@chefsbook/db';
import { useTheme } from '../context/ThemeContext';
import { useAuthStore } from '../lib/zustand/authStore';
import VerifiedBadge from './VerifiedBadge';

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'comments', label: 'Comments' },
  { key: 'recipe_like', label: 'Likes' },
  { key: 'new_follower', label: 'Followers' },
  { key: 'moderation', label: 'Moderation' },
];

function matchesTab(type: string | undefined, tab: string): boolean {
  if (!type) return false;
  if (tab === 'all') return true;
  if (tab === 'comments') return type === 'recipe_comment' || type === 'comment_reply';
  return type === tab;
}

function timeAgo(d: string): string {
  const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
}

function emojiForType(type: string | undefined): string {
  switch (type) {
    case 'recipe_like':
      return '❤️';
    case 'new_follower':
      return '👤';
    case 'moderation':
      return '🛡️';
    case 'recipe_comment':
    case 'comment_reply':
      return '💬';
    default:
      return '🔔';
  }
}

export default function NotificationBell() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const userId = useAuthStore((s) => s.session?.user?.id);

  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [tab, setTab] = useState('all');
  const [verifiedUserIds, setVerifiedUserIds] = useState<Set<string>>(new Set());

  // Per-mount unique channel suffix so multiple NotificationBell instances
  // (e.g. tabs header + recipe header) don't collide on the same channel name.
  // Reusing a name returns the already-subscribed channel, and Supabase throws
  // when .on() is called after .subscribe().
  const channelKeyRef = useRef(`${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

  // Initial unread count + realtime subscription
  useEffect(() => {
    if (!userId) return;
    getUnreadCount(userId).then(setCount).catch(() => {});

    const channel = supabase
      .channel(`notifications-${userId}-${channelKeyRef.current}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload: any) => {
          const newNotif = payload.new;
          if (newNotif) {
            setNotifications((prev) => [newNotif, ...prev]);
            if (!newNotif.is_read) setCount((c) => c + 1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const loadNotifications = useCallback(async () => {
    if (!userId) return;
    const data = await getNotifications(userId);
    setNotifications(data);
    // Fetch verified status for all actors
    const actorIds = data.map((n: any) => n.actor_id).filter((id: string | null): id is string => !!id);
    if (actorIds.length > 0) {
      const verifiedIds = await getVerifiedUserIds([...new Set(actorIds)]);
      setVerifiedUserIds(verifiedIds);
    }
  }, [userId]);

  const openPanel = async () => {
    if (!userId) return;
    setOpen(true);
    await loadNotifications();
  };

  const closePanel = () => {
    setOpen(false);
    if (userId) getUnreadCount(userId).then(setCount).catch(() => {});
  };

  const markRead = async (id: string) => {
    await markNotificationRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    setCount((c) => Math.max(0, c - 1));
  };

  const markAllRead = async () => {
    if (!userId) return;
    await markAllNotificationsRead(userId);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setCount(0);
  };

  const handlePressNotification = async (n: any) => {
    if (!n.is_read) {
      await markRead(n.id);
    }
    setOpen(false);
    // Navigate
    if (
      (n.type === 'recipe_comment' ||
        n.type === 'comment_reply' ||
        n.type === 'recipe_like') &&
      n.recipe_id
    ) {
      router.push(`/recipe/${n.recipe_id}`);
    } else if (n.type === 'new_follower' && n.actor_id) {
      router.push(`/chef/${n.actor_id}`);
    }
  };

  const filtered = notifications.filter((n) => matchesTab(n.type, tab));

  const renderItem = ({ item: n }: { item: any }) => (
    <TouchableOpacity
      onPress={() => handlePressNotification(n)}
      activeOpacity={0.7}
      style={{
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.borderDefault,
        borderLeftWidth: n.is_read ? 0 : 2,
        borderLeftColor: n.is_read ? 'transparent' : colors.accent,
        backgroundColor: colors.bgCard,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: colors.accentSoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 16 }}>{emojiForType(n.type)}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
          {n.actor_username ? (
            <>
              <Text style={{ fontSize: 14, color: colors.textPrimary, fontWeight: '700' }}>@{n.actor_username}</Text>
              {n.actor_id && verifiedUserIds.has(n.actor_id) && <VerifiedBadge size="sm" />}
              <Text style={{ fontSize: 14, color: colors.textPrimary }}> </Text>
            </>
          ) : null}
          <Text style={{ fontSize: 14, color: colors.textPrimary }}>
            {n.batch_count > 1 ? `${n.batch_count} people ` : ''}
            {n.message}
          </Text>
        </View>
        {n.recipe_title ? (
          <Text
            numberOfLines={1}
            style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}
          >
            {n.recipe_title}
          </Text>
        ) : null}
        <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 4 }}>
          {timeAgo(n.created_at)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <>
      <TouchableOpacity
        onPress={openPanel}
        style={{
          minWidth: 44,
          minHeight: 44,
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        <Ionicons
          name={count > 0 ? 'notifications' : 'notifications-outline'}
          size={22}
          color={colors.textMuted}
        />
        {count > 0 && (
          <View
            style={{
              position: 'absolute',
              top: 6,
              right: 6,
              minWidth: 18,
              height: 18,
              borderRadius: 9,
              backgroundColor: colors.accent,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 4,
            }}
          >
            <Text
              style={{
                color: '#ffffff',
                fontSize: 10,
                fontWeight: '700',
              }}
            >
              {count > 99 ? '99+' : count}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={closePanel}
      >
        <Pressable
          onPress={closePanel}
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'flex-end',
          }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: colors.bgCard,
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              maxHeight: '85%',
              paddingBottom: insets.bottom + 16,
            }}
          >
            {/* Header */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 16,
                paddingVertical: 14,
                borderBottomWidth: 1,
                borderBottomColor: colors.borderDefault,
              }}
            >
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: '700',
                  color: colors.textPrimary,
                }}
              >
                Notifications
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <TouchableOpacity onPress={markAllRead}>
                  <Text style={{ fontSize: 13, color: colors.accent, fontWeight: '600' }}>
                    Mark all read
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={closePanel}
                  style={{ padding: 4 }}
                >
                  <Ionicons name="close" size={22} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Tabs */}
            <View
              style={{
                borderBottomWidth: 1,
                borderBottomColor: colors.borderDefault,
              }}
            >
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  gap: 8,
                }}
              >
                {TABS.map((t) => {
                  const active = tab === t.key;
                  return (
                    <TouchableOpacity
                      key={t.key}
                      onPress={() => setTab(t.key)}
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 7,
                        borderRadius: 999,
                        backgroundColor: active ? colors.accent : colors.bgBase,
                        borderWidth: 1,
                        borderColor: active ? colors.accent : colors.borderDefault,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '600',
                          color: active ? '#ffffff' : colors.textSecondary,
                        }}
                      >
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* List */}
            {filtered.length === 0 ? (
              <View
                style={{
                  padding: 40,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 14, color: colors.textMuted }}>
                  No notifications
                </Text>
              </View>
            ) : (
              <FlatList
                data={filtered}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
