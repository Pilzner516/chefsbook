'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { supabase } from '@chefsbook/db';
import type { User } from '@supabase/supabase-js';
import { LANGUAGES, PRIORITY_LANGUAGES, SUPPORTED_LANGUAGES } from '@chefsbook/ui';
import type { UnitSystem } from '@chefsbook/ui';
import { activateLanguage } from '@/lib/i18n';
import { useUnits } from '@/lib/useUnits';
import { proxyIfNeeded } from '@/lib/recipeImage';

type NavItemConfig = {
  key: string;
  href: string;
  label: string;
  countKey?: 'recipes' | 'techniques';
  pro?: boolean;
  icon: React.ReactNode;
};

const DEFAULT_NAV_ITEMS: NavItemConfig[] = [
  { key: 'search', href: '/dashboard/search', label: 'Search', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg> },
  { key: 'my-recipes', href: '/dashboard', label: 'Recipes', countKey: 'recipes', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" /></svg> },
  { key: 'my-techniques', href: '/dashboard/techniques', label: 'Techniques', countKey: 'techniques', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5" /></svg> },
  { key: 'my-cookbooks', href: '/dashboard/cookbooks', label: 'Cookbooks', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0 0 12 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75Z" /></svg> },
  { key: 'print-cookbook', href: '/dashboard/print-cookbook', label: 'Print My ChefsBook', pro: true, icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z" /></svg> },
  { key: 'shopping', href: '/dashboard/shop', label: 'Shopping', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" /></svg> },
  { key: 'meal-plan', href: '/dashboard/plan', label: 'Meal Plan', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" /></svg> },
  { key: 'import-scan', href: '/dashboard/scan', label: 'Import & Scan', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" /></svg> },
  { key: 'speak-recipe', href: '/dashboard/speak', label: 'Speak a Recipe', pro: true, icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" /></svg> },
  { key: 'messages', href: '/dashboard/messages', label: 'Messages', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" /></svg> },
];

const NAV_ONBOARD: Record<string, string> = {
  'Search': 'search', 'Recipes': 'recipes', 'Shopping': 'shopping', 'Meal Plan': 'plan',
};

const NAV_KEYS: Record<string, string> = {
  'Search': 'web.search', 'Recipes': 'web.recipes', 'Techniques': 'web.techniques',
  'Cookbooks': 'web.cookbooks', 'Print My ChefsBook': 'web.printCookbook', 'Shopping': 'web.shopping', 'Meal Plan': 'web.plan',
  'Import & Scan': 'web.import', 'Speak a Recipe': 'web.speak',
};

export default function Sidebar({ user }: { user: User | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const [counts, setCounts] = useState<{ recipes: number; techniques: number }>({ recipes: 0, techniques: 0 });
  const [isAdmin, setIsAdmin] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [language, setLanguageState] = useState('en');
  const { units, setUnits } = useUnits();
  const [langOpen, setLangOpen] = useState(false);
  const [langSearch, setLangSearch] = useState('');
  const langRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('sidebar_collapsed');
    if (saved === 'true') setCollapsed(true);
  }, []);

  // Load profile data (language + avatar) from Supabase
  useEffect(() => {
    if (!user) return;
    supabase.from('user_profiles').select('preferred_language, avatar_url').eq('id', user.id).single().then(({ data }) => {
      if (data) {
        setLanguageState(data.preferred_language || 'en');
        setAvatarUrl(data.avatar_url || null);
      }
    });
  }, [user]);

  // Close language picker on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false);
    };
    if (langOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [langOpen]);

  const setLanguage = async (code: string) => {
    setLanguageState(code);
    setLangOpen(false);
    await activateLanguage(code);
    if (user) await supabase.from('user_profiles').update({ preferred_language: code }).eq('id', user.id);
  };

  const toggleUnits = () => {
    setUnits(units === 'imperial' ? 'metric' : 'imperial');
  };

  useEffect(() => {
    if (!user) return;
    supabase.from('recipes').select('*', { count: 'exact', head: true }).eq('user_id', user.id).then(({ count }) => {
      setCounts((prev) => ({ ...prev, recipes: count ?? 0 }));
    });
    supabase.from('techniques').select('*', { count: 'exact', head: true }).eq('user_id', user.id).then(({ count }) => {
      setCounts((prev) => ({ ...prev, techniques: count ?? 0 }));
    });
    supabase.from('admin_users').select('role').eq('user_id', user.id).single().then(({ data }) => {
      setIsAdmin(!!data);
    });
    supabase.from('user_profiles').select('unread_messages_count').eq('id', user.id).single().then(({ data }) => {
      setUnreadMessages(data?.unread_messages_count ?? 0);
    });
  }, [user]);

  const langCode = (language || 'en').toUpperCase().slice(0, 3);
  const supportedLangs = LANGUAGES.filter((l) => SUPPORTED_LANGUAGES.includes(l.code));
  const priorityLangs = supportedLangs.filter((l) => PRIORITY_LANGUAGES.includes(l.code));
  const otherLangs = supportedLangs.filter((l) => !PRIORITY_LANGUAGES.includes(l.code));
  const filteredLangs = langSearch.trim()
    ? supportedLangs.filter((l) => l.name.toLowerCase().includes(langSearch.toLowerCase()) || l.nativeName.toLowerCase().includes(langSearch.toLowerCase()))
    : null;

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('sidebar_collapsed', String(next));
  };

  return (
    <aside className={`h-screen sticky top-0 border-r border-cb-border bg-cb-card flex flex-col shrink-0 transition-all duration-200 overflow-y-auto ${collapsed ? 'w-14' : 'w-60'}`}>
      <div className="p-3 border-b border-cb-border flex items-center gap-2">
        <button onClick={toggleCollapse} className="text-cb-secondary hover:text-cb-primary shrink-0 p-1.5 rounded-input hover:bg-cb-bg transition-colors" title={collapsed ? 'Show menu' : 'Hide menu'}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
        {!collapsed && (
          <span className="flex items-center gap-1.5 flex-1">
            <Link href="/" data-onboard="logo" className="text-xl font-bold"><span className="text-cb-primary">Chefs</span>book</Link>
            {process.env.NEXT_PUBLIC_APP_URL?.includes(':3001') && (
              <span className="text-[9px] font-bold bg-cb-green text-white px-1.5 py-0.5 rounded -mt-2">STAGING</span>
            )}
          </span>
        )}
        {!collapsed && (
          <div className="flex items-center gap-1.5">
            {/* Language flag */}
            <div ref={langRef} className="relative">
              <button onClick={() => setLangOpen(!langOpen)} className="text-xs font-semibold text-cb-muted p-1.5 hover:bg-cb-bg rounded transition-colors" title="Language">
                {langCode}
              </button>
              {langOpen && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-cb-card border border-cb-border rounded-card shadow-lg z-50 max-h-80 flex flex-col">
                  <div className="p-2 border-b border-cb-border">
                    <input
                      value={langSearch}
                      onChange={(e) => setLangSearch(e.target.value)}
                      placeholder="Search languages..."
                      className="w-full text-sm px-2 py-1.5 rounded-input border border-cb-border bg-cb-bg text-cb-text placeholder:text-cb-muted focus:outline-none focus:border-cb-primary"
                      autoFocus
                    />
                  </div>
                  <div className="overflow-y-auto flex-1">
                    {(filteredLangs ?? [...priorityLangs, ...otherLangs]).map((lang, i) => (
                      <button
                        key={lang.code}
                        onClick={() => setLanguage(lang.code)}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-cb-bg transition-colors ${language === lang.code ? 'bg-cb-primary-soft' : ''} ${!filteredLangs && i === priorityLangs.length - 1 ? 'border-b border-cb-border' : ''}`}
                      >
                        <span className="text-lg">{lang.flag}</span>
                        <span className="text-cb-text flex-1 text-left">{lang.nativeName}</span>
                        {lang.nativeName !== lang.name && <span className="text-cb-muted text-xs">({lang.name})</span>}
                        {language === lang.code && <span className="text-cb-primary">✓</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <nav className="flex-1 p-2 space-y-0.5">
        {DEFAULT_NAV_ITEMS.map((item) => {
          const active = pathname === item.href || (item.href === '/dashboard' && pathname === '/dashboard');
          const count = item.countKey ? counts[item.countKey] : null;
          return (
            <Link
              key={item.key}
              href={item.href}
              data-onboard={NAV_ONBOARD[item.label]}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-input text-sm font-medium transition-colors ${active ? 'bg-cb-primary/10 text-cb-primary' : 'text-cb-secondary hover:text-cb-text hover:bg-cb-bg'}`}
              title={collapsed ? (NAV_KEYS[item.label] ? t(NAV_KEYS[item.label]) : item.label) : undefined}
            >
              {item.icon}
              {!collapsed && (
                <>
                  <span className="flex-1">{NAV_KEYS[item.label] ? t(NAV_KEYS[item.label]) : item.label}</span>
                  {item.pro && <span className="text-[8px] font-bold bg-amber-100 text-amber-700 px-1 py-0.5 rounded">PRO</span>}
                  {count != null && count > 0 && <span className="text-[10px] text-cb-secondary">{count}</span>}
                  {item.label === 'Messages' && unreadMessages > 0 && (
                    <span className="bg-cb-primary text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                      {unreadMessages > 99 ? '99+' : unreadMessages}
                    </span>
                  )}
                </>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-2 border-t border-cb-border space-y-1">
        {/* Unit toggle */}
        {!collapsed && (
          <div className="flex items-center gap-3 px-3 py-2 text-sm">
            <span className="text-cb-secondary font-medium flex-1">Units</span>
            <div className="flex h-6 rounded-full border border-cb-border overflow-hidden text-[11px] font-semibold">
              <button onClick={toggleUnits} className={`px-2 transition-colors ${units === 'metric' ? 'bg-cb-primary text-white' : 'text-cb-muted hover:text-cb-text'}`}>kg</button>
              <button onClick={toggleUnits} className={`px-2 transition-colors ${units === 'imperial' ? 'bg-cb-primary text-white' : 'text-cb-muted hover:text-cb-text'}`}>lb</button>
            </div>
          </div>
        )}
        <Link href="/dashboard/settings" className={`flex items-center gap-3 px-3 py-2.5 rounded-input text-sm font-medium transition-colors ${pathname === '/dashboard/settings' ? 'bg-cb-primary/10 text-cb-primary' : 'text-cb-secondary hover:text-cb-text hover:bg-cb-bg'}`} title={collapsed ? 'Settings' : undefined}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>
          {!collapsed && <span>{t('web.settings')}</span>}
        </Link>
        {isAdmin && (
          <Link href="/admin" className={`flex items-center gap-3 px-3 py-2.5 rounded-input text-sm font-medium transition-colors ${pathname.startsWith('/admin') ? 'bg-cb-primary/10 text-cb-primary' : 'text-cb-primary hover:text-cb-primary hover:bg-cb-bg'}`} title={collapsed ? 'Admin' : undefined}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" /></svg>
            {!collapsed && <span>Admin</span>}
          </Link>
        )}
        <Link href="/extension" className={`flex items-center gap-3 px-3 py-2.5 rounded-input text-sm font-medium transition-colors ${pathname === '/extension' ? 'bg-cb-primary/10 text-cb-primary' : 'text-cb-secondary hover:text-cb-text hover:bg-cb-bg'}`} title={collapsed ? 'Extension' : undefined}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 0 1-.657.643 48.39 48.39 0 0 1-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 0 1-.658.663v0c-.355 0-.676-.186-.959-.401a1.647 1.647 0 0 0-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 0 1-.642 5.056c1.518.19 3.058.309 4.616.354a.64.64 0 0 0 .657-.643v0c0-.355-.186-.676-.401-.959a1.647 1.647 0 0 1-.349-1.003c0-1.035 1.008-1.875 2.25-1.875 1.243 0 2.25.84 2.25 1.875 0 .369-.128.713-.349 1.003-.215.283-.4.604-.4.959v0c0 .333.277.599.61.58a48.1 48.1 0 0 0 5.427-.63 48.05 48.05 0 0 0 .582-4.717.532.532 0 0 0-.533-.57v0c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.035 0-1.875-1.007-1.875-2.25s.84-2.25 1.875-2.25c.37 0 .713.128 1.003.349.283.215.604.401.96.401v0a.656.656 0 0 0 .658-.663 48.422 48.422 0 0 0-.37-5.36c-1.886.342-3.81.574-5.766.689a.578.578 0 0 1-.61-.58v0Z" /></svg>
          {!collapsed && <span>Extension</span>}
        </Link>
        {!collapsed && user && (
          <div className="flex items-center gap-2 px-3 py-1.5">
            {avatarUrl ? (
              <img src={proxyIfNeeded(avatarUrl)} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-cb-primary/20 flex items-center justify-center text-[10px] font-bold text-cb-primary shrink-0">
                {user.email?.charAt(0).toUpperCase() ?? '?'}
              </div>
            )}
            <p className="text-xs text-cb-secondary truncate flex-1">{user.email}</p>
          </div>
        )}
        <button onClick={async () => { await supabase.auth.signOut(); router.push('/auth'); }} className={`flex items-center gap-3 w-full px-3 py-2 rounded-input text-sm font-medium text-cb-secondary hover:text-cb-text hover:bg-cb-bg transition-colors ${collapsed ? 'justify-center' : ''}`} title={collapsed ? 'Sign out' : undefined}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" /></svg>
          {!collapsed && <span>{t('web.signOut')}</span>}
        </button>
      </div>
    </aside>
  );
}
