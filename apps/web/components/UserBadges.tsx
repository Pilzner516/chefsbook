'use client';

import { useState } from 'react';
import VerifiedChefBadge from './VerifiedChefBadge';

interface UserBadgesProps {
  tags: string[];
  createdAt?: string;
  size?: 'sm' | 'md' | 'lg';
}

const SIZES = {
  sm: 'text-[10px]',
  md: 'text-xs',
  lg: 'text-sm',
};

const ICON_SIZES = {
  sm: 'w-3.5 h-3.5',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
};

function BadgePill({ children, color, tooltip, size }: { children: React.ReactNode; color: string; tooltip: string; size: 'sm' | 'md' | 'lg' }) {
  const [showTip, setShowTip] = useState(false);

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setShowTip(true)}
      onMouseLeave={() => setShowTip(false)}
    >
      <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full ${color} ${SIZES[size]} font-medium`}>
        {children}
      </span>
      {showTip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-cb-text text-white text-[10px] rounded whitespace-nowrap z-50">
          {tooltip}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-cb-text" />
        </div>
      )}
    </div>
  );
}

export default function UserBadges({ tags, createdAt, size = 'md' }: UserBadgesProps) {
  const badges: React.ReactNode[] = [];

  // Verified badge (tag: "Verified Chef")
  if (tags.includes('Verified Chef')) {
    badges.push(<VerifiedChefBadge key="verified" size={size} showTooltip />);
  }

  // Featured badge (gold star, tag: "Featured Chef")
  if (tags.includes('Featured Chef')) {
    badges.push(
      <BadgePill key="featured" color="bg-amber-100 text-amber-700" tooltip="Featured Chef" size={size}>
        <span>⭐</span>
      </BadgePill>
    );
  }

  // Author badge (book, tag: "Author")
  if (tags.includes('Author')) {
    badges.push(
      <BadgePill key="author" color="bg-cb-green-soft text-cb-green" tooltip="Published Cookbook Author" size={size}>
        <span>📚</span>
      </BadgePill>
    );
  }

  // New badge (auto-computed from created_at - within 30 days)
  if (createdAt) {
    const createdDate = new Date(createdAt);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    if (createdDate > thirtyDaysAgo) {
      badges.push(
        <span key="new" className={`inline-flex items-center px-1.5 py-0.5 rounded-full bg-cb-bg text-cb-muted ${SIZES[size]} font-medium border border-cb-border`}>
          New
        </span>
      );
    }
  }

  if (badges.length === 0) return null;

  return (
    <span className="inline-flex items-center gap-1 flex-wrap">
      {badges}
    </span>
  );
}
