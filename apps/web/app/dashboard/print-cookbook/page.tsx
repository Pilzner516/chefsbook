'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase, PLAN_LIMITS } from '@chefsbook/db';
import type { PlanTier } from '@chefsbook/db';

interface CookbookDraft {
  id: string;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
  recipe_ids: string[];
  book_layout: unknown;
}

export default function PrintCookbookListPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [session, setSession] = useState<{ access_token: string } | null>(null);
  const [planTier, setPlanTier] = useState<PlanTier>('free');
  const [loading, setLoading] = useState(true);
  const [cookbooks, setCookbooks] = useState<CookbookDraft[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session: sess } } = await supabase.auth.getSession();
    if (!sess?.user) {
      router.push('/auth');
      return;
    }
    setUser(sess.user);
    setSession(sess);

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('plan_tier')
      .eq('id', sess.user.id)
      .single();

    setPlanTier((profile?.plan_tier as PlanTier) || 'free');
    setLoading(false);

    // Load user's cookbook drafts that use the new book_layout system
    const { data } = await supabase
      .from('printed_cookbooks')
      .select('id, title, status, created_at, updated_at, recipe_ids, book_layout')
      .eq('user_id', sess.user.id)
      .not('book_layout', 'is', null)
      .order('updated_at', { ascending: false });

    setCookbooks(data || []);
  };

  const canPrintCookbook = PLAN_LIMITS[planTier]?.canPrintCookbook ?? false;

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm('Delete this cookbook draft? This cannot be undone.')) return;
    if (!session) return;

    try {
      const res = await fetch(`/api/print-cookbook/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (res.ok) {
        setCookbooks((prev) => prev.filter((c) => c.id !== id));
      }
    } catch (error) {
      console.error('Failed to delete cookbook:', error);
    }
  };

  const handleCreateNew = async () => {
    if (!session) return;
    setCreating(true);

    try {
      const res = await fetch('/api/print-cookbook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          title: 'My ChefsBook',
          author: '',
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create cookbook');
      }

      const { id } = await res.json();
      router.push(`/dashboard/print-cookbook/${id}`);
    } catch (error) {
      console.error('Failed to create cookbook:', error);
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center text-cb-secondary py-20">Loading...</div>
      </div>
    );
  }

  // Plan gate - redirect free users
  if (!canPrintCookbook) {
    return (
      <div className="p-8">
        <div className="max-w-lg mx-auto text-center py-20">
          <div className="w-20 h-20 rounded-full bg-cb-primary/10 flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-cb-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold mb-3">Print My ChefsBook</h1>
          <p className="text-cb-secondary mb-6">
            Create a professionally printed cookbook with your favorite recipes.
            This feature is available on Chef, Family, and Pro plans.
          </p>
          <Link
            href="/dashboard/plans?reason=print"
            className="inline-flex items-center gap-2 bg-cb-primary text-white px-6 py-3 rounded-input font-semibold hover:opacity-90 transition-opacity"
          >
            Upgrade to Chef
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Print My ChefsBook</h1>
            <p className="text-cb-secondary text-sm mt-1">
              Design and print a beautiful cookbook with your recipes.
            </p>
          </div>
          <button
            onClick={handleCreateNew}
            disabled={creating}
            className="bg-cb-primary text-white px-5 py-2.5 rounded-input font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-2"
          >
            {creating ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Creating...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Start New Cookbook
              </>
            )}
          </button>
        </div>

        {/* Existing drafts */}
        {cookbooks.length > 0 ? (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-cb-secondary uppercase tracking-wide">Your Cookbooks</h2>
            <div className="grid gap-4">
              {cookbooks.map((cookbook) => (
                <Link
                  key={cookbook.id}
                  href={`/dashboard/print-cookbook/${cookbook.id}`}
                  className="bg-cb-card border border-cb-border rounded-card p-4 flex items-center justify-between hover:border-cb-primary/50 transition-colors"
                >
                  <div>
                    <h3 className="font-semibold">{cookbook.title || 'Untitled Cookbook'}</h3>
                    <p className="text-sm text-cb-secondary mt-0.5">
                      {cookbook.recipe_ids?.length || 0} recipes ·
                      Last edited {new Date(cookbook.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                      cookbook.status === 'ready' ? 'bg-cb-green/10 text-cb-green' :
                      cookbook.status === 'ordered' ? 'bg-purple-100 text-purple-700' :
                      'bg-cb-bg text-cb-secondary'
                    }`}>
                      {cookbook.status === 'ready' ? 'Ready to Print' :
                       cookbook.status === 'ordered' ? 'Ordered' :
                       'Draft'}
                    </span>
                    <button
                      onClick={(e) => handleDelete(cookbook.id, e)}
                      className="p-1.5 text-cb-muted hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                      title="Delete cookbook"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                      </svg>
                    </button>
                    <svg className="w-5 h-5 text-cb-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-16 bg-cb-bg rounded-card border border-cb-border">
            <div className="w-16 h-16 rounded-full bg-cb-primary/10 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-cb-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold mb-2">No cookbooks yet</h2>
            <p className="text-cb-secondary text-sm mb-6 max-w-md mx-auto">
              Create your first printed cookbook by clicking "Start New Cookbook" above.
              You can add recipes, customize the layout, and preview before ordering.
            </p>
            <Link
              href="/dashboard/print"
              className="text-sm text-cb-primary hover:underline"
            >
              Or use the classic wizard →
            </Link>
          </div>
        )}

        {/* Link to classic wizard */}
        <div className="mt-8 p-4 bg-cb-bg rounded-card border border-cb-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-cb-border/50 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-cb-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Looking for the step-by-step wizard?</p>
              <p className="text-xs text-cb-secondary">Use the classic 7-step wizard for a guided experience.</p>
            </div>
            <Link
              href="/dashboard/print"
              className="text-sm text-cb-primary font-medium hover:underline"
            >
              Open Classic Wizard →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
