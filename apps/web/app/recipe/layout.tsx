'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@chefsbook/db';
import type { User } from '@supabase/supabase-js';
import Sidebar from '@/components/Sidebar';

export default function RecipeLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setChecked(true);
    });
  }, []);

  if (!checked) return <>{children}</>;

  // Authenticated: show sidebar
  if (user) {
    return (
      <div className="min-h-screen flex">
        <Sidebar user={user} />
        <main className="flex-1 bg-cb-bg overflow-auto">{children}</main>
      </div>
    );
  }

  // Not authenticated: no sidebar (public recipe view)
  return <>{children}</>;
}
