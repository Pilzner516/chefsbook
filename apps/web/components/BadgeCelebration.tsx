'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@chefsbook/db';

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
  gap_filler_25: 'Twenty-five gaps filled. You are building ChefsBook's intelligence.',
  gap_filler_100: 'One hundred gaps filled. Your contributions shape how thousands cook.',
  first_import: 'You imported your first recipe into ChefsBook.',
  import_10: 'Ten recipes imported. Your collection is growing.',
  import_50: 'Fifty recipes imported. You are building a personal library.',
};

export default function BadgeCelebration({ userId, onClose }: Props) {
  const [badge, setBadge] = useState<BadgeDefinition | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!userId) return;

    // Check localStorage for unshown badges
    const shownBadges = JSON.parse(localStorage.getItem('shownBadges') || '[]');

    const checkNewBadges = async () => {
      try {
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
          }
        }
      } catch (error) {
        console.error('Failed to check badges:', error);
      }
    };

    checkNewBadges();
  }, [userId]);

  const handleClose = () => {
    if (badge) {
      // Mark as shown in localStorage
      const shownBadges = JSON.parse(localStorage.getItem('shownBadges') || '[]');
      shownBadges.push(badge.id);
      localStorage.setItem('shownBadges', JSON.stringify(shownBadges));
    }

    setShow(false);
    setBadge(null);
    onClose?.();
  };

  if (!show || !badge) return null;

  const message = CELEBRATION_MESSAGES[badge.id] || badge.description;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-8 text-center animate-fade-in">
        {/* Badge Icon */}
        <div className="text-6xl mb-4">{badge.icon}</div>

        {/* Badge Name */}
        <h2 className="text-2xl font-bold text-cb-text mb-3">{badge.name}</h2>

        {/* Personal Message */}
        <p className="text-cb-secondary text-lg mb-6">{message}</p>

        {/* Close Button */}
        <button
          onClick={handleClose}
          className="bg-cb-primary text-white px-8 py-3 rounded-input text-sm font-semibold hover:opacity-90 transition"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
