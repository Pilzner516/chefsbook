'use client';

import { useState } from 'react';

interface VerifiedChefBadgeProps {
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
}

const SIZES = {
  sm: 16,
  md: 20,
  lg: 32,
};

export default function VerifiedChefBadge({ size = 'md', showTooltip = true }: VerifiedChefBadgeProps) {
  const [showTip, setShowTip] = useState(false);
  const px = SIZES[size];

  return (
    <div
      className="relative inline-flex items-center justify-center shrink-0"
      style={{ verticalAlign: 'middle' }}
      onMouseEnter={() => showTooltip && setShowTip(true)}
      onMouseLeave={() => setShowTip(false)}
    >
      <svg
        width={px}
        height={px}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Red circle with thin white border */}
        <circle cx="12" cy="12" r="11" fill="#ce2b37" stroke="white" strokeWidth="1" />
        {/* White checkmark - Twitter-style proportions */}
        <path
          d="M7 12.5L10.5 16L17 9"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>

      {/* Tooltip */}
      {showTip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-cb-text text-white text-[10px] rounded whitespace-nowrap z-50">
          Verified Chef · Recognized by Chefsbook
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-cb-text" />
        </div>
      )}
    </div>
  );
}
