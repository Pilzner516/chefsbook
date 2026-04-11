'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@chefsbook/db';
import type { User } from '@supabase/supabase-js';
import Sidebar from '@/components/Sidebar';
import OnboardingOverlay from '@/components/OnboardingOverlay';
import NotificationBell from '@/components/NotificationBell';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [recipesFrozen, setRecipesFrozen] = useState(false);
  const [frozenDismissed, setFrozenDismissed] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace('/auth');
      } else {
        setUser(user);
        supabase.from('user_profiles').select('recipes_frozen').eq('id', user.id).single().then(({ data }) => {
          if (data?.recipes_frozen) setRecipesFrozen(true);
        });
        setChecking(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        router.replace('/auth');
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  if (checking) {
    return <div className="min-h-screen flex items-center justify-center text-cb-secondary">Loading...</div>;
  }

  return (
    <div className="min-h-screen flex">
      <Sidebar user={user} />
      <main className="flex-1 bg-cb-bg overflow-auto relative">
        <div className="absolute top-3 right-4 z-40">
          <NotificationBell />
        </div>
        {recipesFrozen && !frozenDismissed && (
          <div className="bg-amber-50 border-b border-amber-300 px-6 py-4">
            <div className="flex items-start gap-3 max-w-4xl">
              <span className="text-xl">🔒</span>
              <div className="flex-1">
                <p className="font-semibold text-amber-900 text-sm">Account Under Review</p>
                <p className="text-amber-800 text-xs mt-1">Your public recipes have been temporarily hidden pending review. You can still access your private recipes.</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <a href="mailto:support@chefsbk.app" className="text-xs font-semibold text-amber-900 bg-amber-200 px-3 py-1.5 rounded hover:bg-amber-300 transition-colors">Contact Support</a>
                <button onClick={() => setFrozenDismissed(true)} className="text-xs text-amber-700 px-2 py-1.5 hover:text-amber-900">Dismiss</button>
              </div>
            </div>
          </div>
        )}
        {children}
        {(() => {
          const pageMap: Record<string, string> = {
            '/dashboard': 'dashboard',
            '/dashboard/scan': 'scan',
            '/dashboard/shop': 'shop',
            '/dashboard/plan': 'plan',
            '/dashboard/settings': 'settings',
          };
          const pageId = pageMap[pathname] ?? (pathname.startsWith('/dashboard/recipe') ? 'recipe' : '');
          return pageId ? <OnboardingOverlay pageId={pageId} /> : null;
        })()}
      </main>
    </div>
  );
}
