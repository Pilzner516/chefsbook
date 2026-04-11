'use client';

import { useState } from 'react';
import type { Store } from '@chefsbook/db';

function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = ['#ce2b37', '#009246', '#1a73e8', '#f4a01c', '#7c3aed', '#0891b2'];
  return colors[Math.abs(hash) % colors.length];
}

export default function StoreAvatar({ store, size = 36 }: { store: Store | null | undefined; size?: number }) {
  const [logoError, setLogoError] = useState(false);

  if (!store || logoError || !store.logo_url) {
    const initials = store?.initials ?? store?.name?.slice(0, 2).toUpperCase() ?? '?';
    const bg = stringToColor(store?.name ?? '');
    return (
      <div
        style={{
          width: size, height: size, borderRadius: '50%',
          background: bg, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: size * 0.35, fontWeight: 600, flexShrink: 0,
        }}
      >
        {initials}
      </div>
    );
  }

  return (
    <img
      src={store.logo_url}
      alt={store.name}
      width={size}
      height={size}
      style={{ borderRadius: '50%', objectFit: 'contain', flexShrink: 0 }}
      onError={() => setLogoError(true)}
    />
  );
}
