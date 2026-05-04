'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@chefsbook/db';

interface BadgeDefinition {
  name: string;
  description: string;
  icon: string;
  category: string;
}

interface UserBadge {
  badge_id: string;
  earned_at: string;
  badge_definitions: BadgeDefinition;
}

interface Props {
  userId: string;
}

export default function AchievementBadges({ userId }: Props) {
  const [badges, setBadges] = useState<UserBadge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadBadges = async () => {
      try {
        const { data } = await supabase
          .from('user_badges')
          .select(`
            badge_id,
            earned_at,
            badge_definitions!inner (
              name,
              description,
              icon,
              category
            )
          `)
          .eq('user_id', userId)
          .order('earned_at', { ascending: false });

        setBadges((data || []) as unknown as UserBadge[]);
      } catch (error) {
        console.error('Failed to load badges:', error);
      } finally {
        setLoading(false);
      }
    };

    loadBadges();
  }, [userId]);

  if (loading) return null;
  if (badges.length === 0) return null;

  return (
    <div className="bg-cb-card border border-cb-border rounded-card p-6 mb-6">
      <h2 className="text-lg font-semibold text-cb-text mb-4">Achievements</h2>
      <div className="flex flex-wrap gap-3">
        {badges.map((badge) => (
          <div
            key={badge.badge_id}
            className="group relative"
            title={`${badge.badge_definitions.name}: ${badge.badge_definitions.description}`}
          >
            <div className="w-12 h-12 rounded-full bg-cb-bg border border-cb-border flex items-center justify-center text-2xl hover:bg-cb-base transition cursor-help">
              {badge.badge_definitions.icon}
            </div>
            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-cb-text text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 max-w-xs">
              <p className="font-semibold">{badge.badge_definitions.name}</p>
              <p className="text-gray-300 mt-0.5">{badge.badge_definitions.description}</p>
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-cb-text" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
