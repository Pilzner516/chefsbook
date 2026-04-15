'use client';

import { useEffect, useState } from 'react';

interface Props {
  domain: string;
  onClose?: () => void;
  autoDismissMs?: number;
}

export function DiscoveryToast({ domain, onClose, autoDismissMs = 7000 }: Props) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false);
      onClose?.();
    }, autoDismissMs);
    return () => clearTimeout(t);
  }, [autoDismissMs, onClose]);

  if (!visible) return null;

  return (
    <div
      role="status"
      className="fixed bottom-6 right-6 z-50 max-w-sm rounded-card border-l-4 border-cb-green bg-cb-card px-5 py-4 shadow-lg animate-[fadeIn_240ms_ease-out]"
      style={{ boxShadow: '0 8px 28px rgba(0, 146, 70, 0.18)' }}
    >
      <button
        type="button"
        onClick={() => { setVisible(false); onClose?.(); }}
        className="absolute top-2 right-2 text-cb-muted hover:text-cb-text text-lg leading-none"
        aria-label="Dismiss"
      >
        ×
      </button>
      <div className="flex items-start gap-3 pr-4">
        <span className="text-2xl leading-none" aria-hidden>🌍</span>
        <div>
          <p className="font-semibold text-cb-text">
            You&rsquo;ve helped ChefsBook discover something new
          </p>
          <p className="mt-1 text-sm text-cb-secondary leading-snug">
            We hadn&rsquo;t seen <span className="font-medium text-cb-text">{domain}</span> before.
            We&rsquo;ve added it to our list and we&rsquo;ll test it soon so every future
            import from this site works beautifully. Thank you for expanding our recipe world.
          </p>
        </div>
      </div>
    </div>
  );
}
