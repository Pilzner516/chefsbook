import React from 'react';

interface LibraryBadgeProps {
  /** Size variant */
  size?: 'sm' | 'md';
  /** Optional custom class name */
  className?: string;
}

/**
 * LibraryBadge component
 *
 * Displays a "📚 Library" badge for library accounts (account_type='library').
 * Styled to match the Trattoria theme with amber/gold accent.
 *
 * Usage:
 * ```tsx
 * {profile.account_type === 'library' && <LibraryBadge />}
 * ```
 */
export function LibraryBadge({ size = 'md', className = '' }: LibraryBadgeProps) {
  const sizeClasses = {
    sm: 'px-1.5 py-0.5 text-xs',
    md: 'px-2 py-1 text-sm',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 bg-amber-100 text-amber-800 font-medium rounded ${sizeClasses[size]} ${className}`}
      title="Official ChefsBook Library account"
    >
      <span>📚</span>
      <span>Library</span>
    </span>
  );
}
