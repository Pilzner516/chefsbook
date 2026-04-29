'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@chefsbook/db';
import Link from 'next/link';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';

type AdminNavItem = {
  key: string;
  href: string;
  label: string;
};

const DEFAULT_REORDERABLE_NAV: AdminNavItem[] = [
  { key: 'overview', href: '/admin', label: 'Overview' },
  { key: 'users', href: '/admin/users', label: 'Users' },
  { key: 'messages-flags', href: '/admin/messages', label: 'Messages & Flags' },
  { key: 'tags', href: '/admin/tags', label: 'Tags' },
  { key: 'audit', href: '/admin/audit', label: 'Content Audit' },
  { key: 'recipes', href: '/admin/recipes', label: 'Recipes' },
  { key: 'promos', href: '/admin/promos', label: 'Promo Codes' },
  { key: 'limits', href: '/admin/limits', label: 'Plan Limits' },
  { key: 'feedback', href: '/admin/feedback', label: 'User Feedback' },
  { key: 'reserved-usernames', href: '/admin/reserved-usernames', label: 'Reserved Usernames' },
  { key: 'import-sites', href: '/admin/import-sites', label: 'Import Sites' },
  { key: 'incomplete-recipes', href: '/admin/incomplete-recipes', label: 'Incomplete Recipes' },
  { key: 'copyright', href: '/admin/copyright', label: 'Copyright' },
  { key: 'costs', href: '/admin/costs', label: 'Costs' },
  { key: 'nutrition', href: '/admin/nutrition', label: 'Nutrition' },
  { key: 'cookbook-templates', href: '/admin/cookbook-templates', label: 'Cookbook Templates' },
];

const FIXED_NAV: AdminNavItem[] = [
  { key: 'settings', href: '/admin/settings', label: 'Settings' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [adminRole, setAdminRole] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [adminNavOrder, setAdminNavOrder] = useState<string[] | null>(null);
  const [orderedNavItems, setOrderedNavItems] = useState<AdminNavItem[]>(DEFAULT_REORDERABLE_NAV);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace('/dashboard');
        return;
      }
      setUserId(user.id);
      // Query admin_users — RLS allows admins to read their own row
      supabase
        .from('admin_users')
        .select('role')
        .eq('user_id', user.id)
        .single()
        .then(({ data }) => {
          if (!data) {
            router.replace('/dashboard');
          } else {
            setAdminRole(data.role);
            setChecking(false);
          }
        });
    });
  }, [router]);

  // Load user's admin nav order preference
  useEffect(() => {
    if (!userId) return;
    supabase.from('user_profiles').select('admin_nav_order').eq('id', userId).single().then(({ data }) => {
      setAdminNavOrder(data?.admin_nav_order ?? null);
    });
  }, [userId]);

  // Reorder nav items based on admin_nav_order
  useEffect(() => {
    if (!adminNavOrder) {
      setOrderedNavItems(DEFAULT_REORDERABLE_NAV);
      return;
    }
    // Build a map of all nav items by key
    const itemMap = new Map(DEFAULT_REORDERABLE_NAV.map(item => [item.key, item]));
    // Order items according to admin_nav_order, then append any missing items
    const ordered: AdminNavItem[] = [];
    for (const key of adminNavOrder) {
      const item = itemMap.get(key);
      if (item) {
        ordered.push(item);
        itemMap.delete(key);
      }
    }
    // Append any items not in admin_nav_order (new features added after user set their order)
    for (const item of itemMap.values()) {
      ordered.push(item);
    }
    setOrderedNavItems(ordered);
  }, [adminNavOrder]);

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination || !userId) return;
    const items = Array.from(orderedNavItems);
    const [reordered] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reordered);
    setOrderedNavItems(items);
    const newOrder = items.map(item => item.key);
    setAdminNavOrder(newOrder);
    // Save to database
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error('No session found for admin nav order save');
        return;
      }
      const response = await fetch('/api/admin/nav-order', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ adminNavOrder: newOrder }),
      });
      if (!response.ok) {
        const error = await response.json();
        console.error('Failed to save admin nav order:', error);
      } else {
        console.log('Admin nav order saved successfully');
      }
    } catch (err) {
      console.error('Failed to save admin nav order:', err);
    }
  };

  const resetNavOrder = async () => {
    if (!userId) return;
    setAdminNavOrder(null);
    setOrderedNavItems(DEFAULT_REORDERABLE_NAV);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error('No session found for admin nav order reset');
        return;
      }
      const response = await fetch('/api/admin/nav-order', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ adminNavOrder: null }),
      });
      if (!response.ok) {
        const error = await response.json();
        console.error('Failed to reset admin nav order:', error);
      } else {
        console.log('Admin nav order reset successfully');
      }
    } catch (err) {
      console.error('Failed to reset admin nav order:', err);
    }
  };

  if (checking) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className="w-56 bg-white border-r border-gray-200 flex-shrink-0">
        <div className="p-4 border-b border-gray-200">
          <Link href="/admin" className="text-lg font-bold">
            <span className="text-cb-primary">CB</span> Admin
          </Link>
          {adminRole && <p className="text-xs text-gray-500 mt-1">{adminRole.replace('_', ' ')}</p>}
        </div>
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="admin-nav-items">
            {(provided) => (
              <nav
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="p-2 flex-1 overflow-y-auto"
              >
                {orderedNavItems.map((item, index) => (
                  <Draggable key={item.key} draggableId={item.key} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`${snapshot.isDragging ? 'opacity-50' : ''}`}
                      >
                        <Link
                          href={item.href}
                          className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition group"
                        >
                          <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                            </svg>
                          </div>
                          <span className="flex-1">{item.label}</span>
                        </Link>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
                {adminNavOrder && (
                  <button
                    onClick={resetNavOrder}
                    className="text-xs text-gray-500 hover:text-cb-primary px-3 py-1.5 w-full text-left"
                  >
                    Reset to default order
                  </button>
                )}
              </nav>
            )}
          </Droppable>
        </DragDropContext>
        <div className="p-2 border-t border-gray-200">
          {FIXED_NAV.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className="block px-3 py-2 rounded-md text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition"
            >
              {item.label}
            </Link>
          ))}
          <Link href="/dashboard" className="block px-3 py-2 rounded-md text-xs text-gray-500 hover:text-gray-700">
            ← Back to app
          </Link>
        </div>
      </aside>
      <main className="flex-1 p-6 overflow-auto">
        {children}
      </main>
    </div>
  );
}
