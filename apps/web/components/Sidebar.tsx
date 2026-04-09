'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@chefsbook/db';
import type { User } from '@supabase/supabase-js';
import { LANGUAGES, PRIORITY_LANGUAGES } from '@chefsbook/ui';
import type { UnitSystem } from '@chefsbook/ui';

const navItems = [
  { href: '/dashboard/search', label: 'Search', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg> },
  { href: '/dashboard', label: 'Recipes', countKey: 'recipes' as const, icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" /></svg> },
  { href: '/dashboard/techniques', label: 'Techniques', countKey: 'techniques' as const, icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5" /></svg> },
  { href: '/dashboard/cookbooks', label: 'Cookbooks', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0 0 12 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75Z" /></svg> },
  { href: '/dashboard/discover', label: 'Discover', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" /></svg> },
  { href: '/dashboard/shop', label: 'Shopping', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" /></svg> },
  { href: '/dashboard/plan', label: 'Meal Plan', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" /></svg> },
  { href: '/dashboard/scan', label: 'Import & Scan', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" /></svg> },
  { href: '/dashboard/speak', label: 'Speak a Recipe', pro: true, icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" /></svg> },
];

export default function Sidebar({ user }: { user: User | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [counts, setCounts] = useState<{ recipes: number; techniques: number }>({ recipes: 0, techniques: 0 });
  const [language, setLanguageState] = useState('en');
  const [units, setUnitsState] = useState<UnitSystem>('imperial');
  const [langOpen, setLangOpen] = useState(false);
  const [langSearch, setLangSearch] = useState('');
  const langRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('sidebar_collapsed');
    if (saved === 'true') setCollapsed(true);
  }, []);

  // Load preferences from Supabase
  useEffect(() => {
    if (!user) return;
    supabase.from('user_profiles').select('preferred_language, preferred_units').eq('id', user.id).single().then(({ data }) => {
      if (data) {
        setLanguageState(data.preferred_language || 'en');
        setUnitsState((data.preferred_units as UnitSystem) || 'imperial');
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
    if (user) await supabase.from('user_profiles').update({ preferred_language: code }).eq('id', user.id);
  };

  const toggleUnits = async () => {
    const next = units === 'imperial' ? 'metric' : 'imperial';
    setUnitsState(next);
    if (user) await supabase.from('user_profiles').update({ preferred_units: next }).eq('id', user.id);
  };

  useEffect(() => {
    if (!user) return;
    supabase.from('recipes').select('*', { count: 'exact', head: true }).eq('user_id', user.id).then(({ count }) => {
      setCounts((prev) => ({ ...prev, recipes: count ?? 0 }));
    });
    supabase.from('techniques').select('*', { count: 'exact', head: true }).eq('user_id', user.id).then(({ count }) => {
      setCounts((prev) => ({ ...prev, techniques: count ?? 0 }));
    });
  }, [user]);

  const langCode = (language || 'en').toUpperCase().slice(0, 3);
  const priorityLangs = LANGUAGES.filter((l) => PRIORITY_LANGUAGES.includes(l.code));
  const otherLangs = LANGUAGES.filter((l) => !PRIORITY_LANGUAGES.includes(l.code));
  const filteredLangs = langSearch.trim()
    ? LANGUAGES.filter((l) => l.name.toLowerCase().includes(langSearch.toLowerCase()) || l.nativeName.toLowerCase().includes(langSearch.toLowerCase()))
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
            <Link href="/" className="text-xl font-bold"><span className="text-cb-primary">Chefs</span>book</Link>
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
        {navItems.map((item) => {
          const active = pathname === item.href || (item.href === '/dashboard' && pathname === '/dashboard');
          const count = (item as any).countKey ? counts[(item as any).countKey as keyof typeof counts] : null;
          return (
            <Link key={item.label} href={item.href} className={`flex items-center gap-3 px-3 py-2.5 rounded-input text-sm font-medium transition-colors ${active ? 'bg-cb-primary/10 text-cb-primary' : 'text-cb-secondary hover:text-cb-text hover:bg-cb-bg'}`} title={collapsed ? item.label : undefined}>
              {item.icon}
              {!collapsed && (
                <>
                  <span className="flex-1">{item.label}</span>
                  {(item as any).pro && <span className="text-[8px] font-bold bg-amber-100 text-amber-700 px-1 py-0.5 rounded">PRO</span>}
                  {count != null && count > 0 && <span className="text-[10px] text-cb-secondary">{count}</span>}
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
          {!collapsed && <span>Settings</span>}
        </Link>
        {!collapsed && user && (
          <div className="flex items-center gap-2 px-3 py-1.5">
            <div className="w-6 h-6 rounded-full bg-cb-primary/20 flex items-center justify-center text-[10px] font-bold text-cb-primary shrink-0">
              {user.email?.charAt(0).toUpperCase() ?? '?'}
            </div>
            <p className="text-xs text-cb-secondary truncate flex-1">{user.email}</p>
          </div>
        )}
        <button onClick={async () => { await supabase.auth.signOut(); router.push('/auth'); }} className={`flex items-center gap-3 w-full px-3 py-2 rounded-input text-sm font-medium text-cb-secondary hover:text-cb-text hover:bg-cb-bg transition-colors ${collapsed ? 'justify-center' : ''}`} title={collapsed ? 'Sign out' : undefined}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" /></svg>
          {!collapsed && <span>Sign out</span>}
        </button>
      </div>
    </aside>
  );
}
