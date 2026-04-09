import { supabase } from '@chefsbook/db';
import { redirect } from 'next/navigation';
import Link from 'next/link';

const NAV = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/flags', label: 'Flagged Comments' },
  { href: '/admin/recipes', label: 'Recipes' },
  { href: '/admin/promos', label: 'Promo Codes' },
  { href: '/admin/limits', label: 'Plan Limits' },
  { href: '/admin/help', label: 'Help Requests' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Check admin access
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) redirect('/dashboard');

  const { data: admin } = await supabase
    .from('admin_users')
    .select('role')
    .eq('user_id', session.user.id)
    .single();

  if (!admin) redirect('/dashboard');

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className="w-56 bg-white border-r border-gray-200 flex-shrink-0">
        <div className="p-4 border-b border-gray-200">
          <Link href="/admin" className="text-lg font-bold">
            <span className="text-cb-primary">CB</span> Admin
          </Link>
          <p className="text-xs text-gray-500 mt-1">{admin.role.replace('_', ' ')}</p>
        </div>
        <nav className="p-2">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block px-3 py-2 rounded-md text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-4 mt-auto border-t border-gray-200">
          <Link href="/dashboard" className="text-xs text-gray-500 hover:text-gray-700">
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
