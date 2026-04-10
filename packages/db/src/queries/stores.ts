import { supabase } from '../client';

export interface Store {
  id: string;
  user_id: string;
  name: string;
  domain: string | null;
  logo_url: string | null;
  initials: string | null;
  created_at: string;
}

const KNOWN_DOMAINS: Record<string, string> = {
  'wholefoods': 'wholefoodsmarket.com',
  'shoprite': 'shoprite.com',
  'traderjoes': 'traderjoes.com',
  'stopandshop': 'stopandshop.com',
  'costco': 'costco.com',
  'target': 'target.com',
  'walmart': 'walmart.com',
  'kroger': 'kroger.com',
  'publix': 'publix.com',
  'wegmans': 'wegmans.com',
  'aldi': 'aldi.us',
  'deciccos': 'deciccos.com',
  'keyfoods': 'keyfood.com',
  'foodtown': 'foodtown.com',
  'stew': 'stewleonards.com',
  'stewleonards': 'stewleonards.com',
};

const LOGO_TOKEN = 'pk_EXpCeGY3QxS0VKVRKTr_pw';

function computeInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 3)
    .map((w) => w[0].toUpperCase())
    .join('') || name.slice(0, 2).toUpperCase();
}

function guessDomain(name: string): string {
  const key = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  return KNOWN_DOMAINS[key] ?? `${key}.com`;
}

export async function getUserStores(userId: string): Promise<Store[]> {
  const { data } = await supabase
    .from('stores')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return (data ?? []) as Store[];
}

export async function createStore(params: {
  userId: string;
  name: string;
}): Promise<Store> {
  const { userId, name } = params;
  const domain = guessDomain(name);
  const initials = computeInitials(name);
  const logoUrl = `https://img.logo.dev/${domain}?token=${LOGO_TOKEN}`;

  const { data, error } = await supabase
    .from('stores')
    .insert({
      user_id: userId,
      name,
      domain,
      logo_url: logoUrl,
      initials,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Store;
}

export async function updateStoreLogo(storeId: string, logoUrl: string): Promise<void> {
  await supabase.from('stores').update({ logo_url: logoUrl }).eq('id', storeId);
}
