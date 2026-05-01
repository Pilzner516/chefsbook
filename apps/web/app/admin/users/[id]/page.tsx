'use client';

import { useState, useEffect, use } from 'react';
import { supabase } from '@chefsbook/db';
import Link from 'next/link';

interface UserDetails {
  id: string;
  username: string | null;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
  plan_tier: string;
  created_at: string;
  account_status: 'active' | 'suspended' | 'expelled';
}

interface SecretFeatures {
  menu_scan_enabled: boolean;
  plan_tier: string;
}

export default function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: userId } = use(params);
  const [user, setUser] = useState<UserDetails | null>(null);
  const [secretFeatures, setSecretFeatures] = useState<SecretFeatures | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadUser();
    loadSecretFeatures();
  }, [userId]);

  const loadUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError('Not authenticated');
        setLoading(false);
        return;
      }

      const res = await fetch(`/api/admin?page=users&search=${userId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!res.ok) throw new Error('Failed to load user');

      const data = await res.json();
      const found = data.users?.find((u: UserDetails) => u.id === userId);
      setUser(found || null);
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  const loadSecretFeatures = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const res = await fetch(`/api/admin/users/${userId}/secret-features`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setSecretFeatures(data);
      }
    } catch (err) {
      console.error('Failed to load secret features:', err);
    }
  };

  const toggleMenuScan = async () => {
    if (!secretFeatures) return;
    setSaving(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const res = await fetch(`/api/admin/users/${userId}/secret-features`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          menu_scan_enabled: !secretFeatures.menu_scan_enabled,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update');
      }

      setSecretFeatures({
        ...secretFeatures,
        menu_scan_enabled: !secretFeatures.menu_scan_enabled,
      });
    } catch (err: any) {
      setError(err.message);
    }
    setSaving(false);
  };

  const isPro = secretFeatures?.plan_tier === 'pro';

  if (loading) {
    return (
      <div className="p-8">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-8">
        <Link href="/admin/users" className="text-cb-primary hover:underline text-sm mb-4 inline-block">
          ← Back to Users
        </Link>
        <p className="text-gray-500">User not found</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <Link href="/admin/users" className="text-cb-primary hover:underline text-sm mb-4 inline-block">
        ← Back to Users
      </Link>

      <div className="flex items-center gap-4 mb-6">
        {user.avatar_url ? (
          <img
            src={user.avatar_url.startsWith('http') ? `/api/image?url=${encodeURIComponent(user.avatar_url)}` : user.avatar_url}
            alt=""
            className="w-16 h-16 rounded-full object-cover bg-gray-100"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-2xl font-medium text-gray-500">
            {(user.display_name || user.username || user.email || 'U').charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {user.display_name || user.username || 'Unnamed User'}
          </h1>
          <p className="text-gray-500">
            {user.username ? `@${user.username}` : user.email}
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3 mb-4">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <h2 className="font-semibold text-gray-900 mb-3">Account Information</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Plan:</span>
            <span className="ml-2 font-medium capitalize">{user.plan_tier}</span>
          </div>
          <div>
            <span className="text-gray-500">Status:</span>
            <span className={`ml-2 font-medium capitalize ${
              user.account_status === 'active' ? 'text-green-600' :
              user.account_status === 'suspended' ? 'text-amber-600' : 'text-red-600'
            }`}>
              {user.account_status}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Joined:</span>
            <span className="ml-2">{new Date(user.created_at).toLocaleDateString()}</span>
          </div>
          <div>
            <span className="text-gray-500">User ID:</span>
            <span className="ml-2 font-mono text-xs">{user.id.slice(0, 8)}...</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h2 className="font-semibold text-gray-900 mb-3">Secret Features</h2>
        <p className="text-sm text-gray-500 mb-4">
          These features are admin-controlled and hidden from users until enabled.
        </p>

        <div className="border-t border-gray-100 pt-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h3 className="font-medium text-gray-900">Restaurant Menu Scan (Pro only)</h3>
              <p className="text-sm text-gray-500 mt-1">
                Allows this user to scan restaurant menus and extract dishes as recipes.
                Only activates for Pro users. Off by default.
              </p>
              {!isPro && (
                <p className="text-sm text-amber-600 mt-2">
                  User must be on Pro plan to use this feature.
                </p>
              )}
            </div>
            <div className="flex-shrink-0">
              <button
                onClick={toggleMenuScan}
                disabled={saving || !isPro}
                className={`
                  relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                  ${!isPro ? 'bg-gray-200 cursor-not-allowed' :
                    secretFeatures?.menu_scan_enabled ? 'bg-cb-primary' : 'bg-gray-300'
                  }
                `}
              >
                <span
                  className={`
                    inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow
                    ${secretFeatures?.menu_scan_enabled ? 'translate-x-6' : 'translate-x-1'}
                  `}
                />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
