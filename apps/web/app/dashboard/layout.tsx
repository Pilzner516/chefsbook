'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@chefsbook/db';
import type { User } from '@supabase/supabase-js';
import Sidebar from '@/components/Sidebar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace('/auth');
      } else {
        setUser(user);
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
      <main className="flex-1 bg-cb-bg overflow-auto">{children}</main>
    </div>
  );
}
