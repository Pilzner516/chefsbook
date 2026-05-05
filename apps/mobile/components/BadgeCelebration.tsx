import React, { useEffect, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, Animated } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@chefsbook/db';
import { useTheme } from '../context/ThemeContext';

interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
}

interface Props {
  userId: string | null;
  onClose?: () => void;
}

const CELEBRATION_MESSAGES: Record<string, string> = {
  first_contribution: 'You taught our Sous Chef something new for the first time.',
  gap_filler_5: 'Five gaps filled. The whole community cooks a little better now.',
  gap_filler_25: "Twenty-five gaps filled. You are building ChefsBook's intelligence.",
  gap_filler_100: 'One hundred gaps filled. Your contributions shape how thousands cook.',
  first_import: 'You imported your first recipe into ChefsBook.',
  import_10: 'Ten recipes imported. Your collection is growing.',
  import_50: 'Fifty recipes imported. You are building a personal library.',
};

export default function BadgeCelebration({ userId, onClose }: Props) {
  const { colors } = useTheme();
  const [badge, setBadge] = useState<BadgeDefinition | null>(null);
  const [show, setShow] = useState(false);
  const scaleAnim = useState(new Animated.Value(0.8))[0];

  useEffect(() => {
    if (!userId) return;

    const checkNewBadges = async () => {
      try {
        // Check AsyncStorage for shown badges
        const shownBadgesJson = await AsyncStorage.getItem('shownBadges');
        const shownBadges = shownBadgesJson ? JSON.parse(shownBadgesJson) : [];

        const { data } = await supabase
          .from('user_badges')
          .select(`
            badge_id,
            earned_at,
            badge_definitions (
              id,
              name,
              description,
              icon,
              category
            )
          `)
          .eq('user_id', userId)
          .order('earned_at', { ascending: false })
          .limit(1);

        if (data && data.length > 0) {
          const latestBadge = data[0];
          const badgeDef = latestBadge.badge_definitions as unknown as BadgeDefinition;

          // Check if we've already shown this badge
          if (!shownBadges.includes(badgeDef.id)) {
            setBadge(badgeDef);
            setShow(true);

            // Animate in
            Animated.spring(scaleAnim, {
              toValue: 1,
              useNativeDriver: true,
              tension: 50,
              friction: 7,
            }).start();
          }
        }
      } catch (error) {
        console.error('Failed to check badges:', error);
      }
    };

    checkNewBadges();
  }, [userId]);

  const handleClose = async () => {
    if (badge) {
      // Mark as shown in AsyncStorage
      const shownBadgesJson = await AsyncStorage.getItem('shownBadges');
      const shownBadges = shownBadgesJson ? JSON.parse(shownBadgesJson) : [];
      shownBadges.push(badge.id);
      await AsyncStorage.setItem('shownBadges', JSON.stringify(shownBadges));
    }

    // Animate out
    Animated.timing(scaleAnim, {
      toValue: 0.8,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setShow(false);
      setBadge(null);
      onClose?.();
    });
  };

  if (!show || !badge) return null;

  const message = CELEBRATION_MESSAGES[badge.id] || badge.description;

  return (
    <Modal transparent visible={show} animationType="fade" onRequestClose={handleClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Animated.View
          style={{
            backgroundColor: colors.bgCard,
            borderRadius: 12,
            padding: 32,
            width: '100%',
            maxWidth: 400,
            alignItems: 'center',
            transform: [{ scale: scaleAnim }],
          }}
        >
          {/* Badge Icon */}
          <Text style={{ fontSize: 64, marginBottom: 16 }}>{badge.icon}</Text>

          {/* Badge Name */}
          <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 12, textAlign: 'center' }}>
            {badge.name}
          </Text>

          {/* Personal Message */}
          <Text style={{ fontSize: 16, color: colors.textSecondary, marginBottom: 24, textAlign: 'center', lineHeight: 24 }}>
            {message}
          </Text>

          {/* Close Button */}
          <TouchableOpacity
            onPress={handleClose}
            style={{
              backgroundColor: colors.accent,
              paddingHorizontal: 32,
              paddingVertical: 12,
              borderRadius: 8,
            }}
          >
            <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>Continue</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}
