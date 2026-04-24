'use client';

import { useState } from 'react';

interface VerifiedChefBadgeProps {
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
}

const SIZES = {
  sm: 16,
  md: 24,
  lg: 48,
};

export default function VerifiedChefBadge({ size = 'md', showTooltip = true }: VerifiedChefBadgeProps) {
  const [showTip, setShowTip] = useState(false);
  const px = SIZES[size];

  return (
    <div
      className="relative inline-flex items-center justify-center shrink-0"
      onMouseEnter={() => showTooltip && setShowTip(true)}
      onMouseLeave={() => setShowTip(false)}
    >
      <svg
        width={px}
        height={px}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="drop-shadow-sm"
      >
        {/* Circular background with subtle shadow effect */}
        <circle cx="50" cy="50" r="48" fill="white" stroke="#ce2b37" strokeWidth="2" />

        {/* Fork (left, rotated -45deg) */}
        <g transform="translate(50, 50) rotate(-35) translate(-50, -50)">
          {/* Fork handle */}
          <line x1="50" y1="75" x2="50" y2="48" stroke="#ce2b37" strokeWidth="2" strokeLinecap="round" />
          {/* Fork tines */}
          <line x1="42" y1="48" x2="42" y2="30" stroke="#ce2b37" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="46" y1="48" x2="46" y2="28" stroke="#ce2b37" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="50" y1="48" x2="50" y2="26" stroke="#ce2b37" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="54" y1="48" x2="54" y2="28" stroke="#ce2b37" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="58" y1="48" x2="58" y2="30" stroke="#ce2b37" strokeWidth="1.5" strokeLinecap="round" />
          {/* Fork neck */}
          <line x1="42" y1="48" x2="58" y2="48" stroke="#ce2b37" strokeWidth="1.5" strokeLinecap="round" />
        </g>

        {/* Knife (right, rotated +35deg) */}
        <g transform="translate(50, 50) rotate(35) translate(-50, -50)">
          {/* Knife handle */}
          <rect x="46" y="55" width="8" height="22" rx="2" fill="#ce2b37" />
          {/* Knife blade */}
          <path
            d="M46 55 L46 28 Q46 24 50 24 Q54 24 54 28 L54 55 Z"
            fill="#ce2b37"
          />
          {/* Blade edge highlight */}
          <line x1="48" y1="54" x2="48" y2="30" stroke="white" strokeWidth="0.5" opacity="0.5" />
        </g>

        {/* Spoon (center, vertical, slightly forward) */}
        <g>
          {/* Spoon handle */}
          <line x1="50" y1="78" x2="50" y2="45" stroke="#ce2b37" strokeWidth="2.5" strokeLinecap="round" />
          {/* Spoon bowl */}
          <ellipse cx="50" cy="32" rx="10" ry="12" fill="#ce2b37" />
          {/* Bowl inner highlight */}
          <ellipse cx="50" cy="31" rx="6" ry="7" fill="white" opacity="0.2" />
        </g>
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
