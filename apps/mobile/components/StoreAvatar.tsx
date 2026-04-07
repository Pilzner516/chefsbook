import React, { useState } from 'react';
import { View, Text, Image } from 'react-native';

// TODO(web): replicate StoreAvatar in apps/web for shopping list parity

const LOGO_DEV_TOKEN = 'pk_EXpCeGY3QxS0VKVRKTr_pw';
const LOGO_BASE = `https://img.logo.dev`;

const KNOWN_STORE_DOMAINS: Record<string, string> = {
  'whole foods': 'wholefoodsmarket.com',
  'shoprite': 'shoprite.com',
  'trader joes': 'traderjoes.com',
  'stop and shop': 'stopandshop.com',
  'costco': 'costco.com',
  'target': 'target.com',
  'walmart': 'walmart.com',
  'kroger': 'kroger.com',
  'publix': 'publix.com',
  'wegmans': 'wegmans.com',
  'aldi': 'aldi.us',
  'deciccos': 'diciccos.com',
};

function buildLogoUrl(domain: string): string {
  return `${LOGO_BASE}/${domain}?token=${LOGO_DEV_TOKEN}`;
}

const KNOWN_STORE_LOGOS: Record<string, string> = Object.fromEntries(
  Object.entries(KNOWN_STORE_DOMAINS).map(([name, domain]) => [name, buildLogoUrl(domain)]),
);

// Deterministic color from store name
const PALETTE = [
  '#ce2b37', '#009246', '#2563eb', '#7c3aed', '#db2777',
  '#ea580c', '#0891b2', '#4f46e5', '#059669', '#d97706',
];

function hashColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PALETTE[Math.abs(hash) % PALETTE.length]!;
}

function normalizeStoreName(name: string): string {
  return name.toLowerCase().replace(/[''&.,!?-]/g, '').replace(/\s+/g, ' ').trim();
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getLogoUrl(storeName: string): string | null {
  const normalized = normalizeStoreName(storeName);
  return KNOWN_STORE_LOGOS[normalized] ?? null;
}

interface Props {
  storeName: string;
  size?: number;
}

export function StoreAvatar({ storeName, size = 36 }: Props) {
  const logoUrl = getLogoUrl(storeName);
  const [logoFailed, setLogoFailed] = useState(false);

  if (logoUrl && !logoFailed) {
    return (
      <Image
        source={{ uri: logoUrl }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 4,
          backgroundColor: '#f5f5f5',
        }}
        onError={() => setLogoFailed(true)}
        resizeMode="contain"
      />
    );
  }

  // Initials fallback
  const bg = hashColor(storeName);
  const initials = getInitials(storeName);

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 4,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          color: '#ffffff',
          fontSize: size * 0.4,
          fontWeight: '700',
        }}
      >
        {initials}
      </Text>
    </View>
  );
}

export { getLogoUrl, getInitials, normalizeStoreName };
