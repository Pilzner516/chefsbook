'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { DiscoveryToast } from './DiscoveryToast';

interface StoredDiscovery {
  isNew: boolean;
  domain: string;
  message?: string;
  subMessage?: string;
}

/**
 * Watches sessionStorage for a pending "new site discovery" message stashed by
 * the import flow and surfaces it once on the next page the user lands on.
 */
export function DiscoveryToastWatcher() {
  const [discovery, setDiscovery] = useState<StoredDiscovery | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = sessionStorage.getItem('chefsbook_discovery');
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as StoredDiscovery;
      if (parsed?.isNew && parsed.domain) {
        setDiscovery(parsed);
        sessionStorage.removeItem('chefsbook_discovery');
      }
    } catch {
      sessionStorage.removeItem('chefsbook_discovery');
    }
  }, [pathname]);

  if (!discovery) return null;
  return <DiscoveryToast domain={discovery.domain} onClose={() => setDiscovery(null)} />;
}
