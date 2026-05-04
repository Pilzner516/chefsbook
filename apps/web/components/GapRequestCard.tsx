'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@chefsbook/db';
import { useRouter } from 'next/navigation';

interface KnowledgeGap {
  id: string;
  technique: string;
  ingredient_category: string | null;
  request_title: string;
  request_body: string;
}

const DISMISS_KEY_PREFIX = 'cb_gap_dismiss_';
const DISMISS_DURATION_DAYS = 7;

/**
 * Community knowledge gap request card.
 * Shows at position 2 in My Recipes grid (after FeedbackCard).
 * Rotates through active gaps, dismissible for 7 days per gap.
 */
export default function GapRequestCard() {
  const router = useRouter();
  const [gap, setGap] = useState<KnowledgeGap | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadActiveGap();
  }, []);

  const loadActiveGap = async () => {
    try {
      // Check if user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Fetch active gaps
      const { data: gaps } = await supabase
        .from('knowledge_gaps')
        .select('id, technique, ingredient_category, request_title, request_body')
        .eq('status', 'active')
        .limit(10);

      if (!gaps || gaps.length === 0) {
        setLoading(false);
        return;
      }

      // Filter out dismissed gaps
      const now = Date.now();
      const availableGaps = gaps.filter((g) => {
        const dismissKey = `${DISMISS_KEY_PREFIX}${g.id}`;
        const dismissedUntil = localStorage.getItem(dismissKey);
        if (!dismissedUntil) return true;
        return parseInt(dismissedUntil, 10) < now;
      });

      if (availableGaps.length === 0) {
        setLoading(false);
        return;
      }

      // Pick one randomly (simple rotation)
      const randomGap = availableGaps[Math.floor(Math.random() * availableGaps.length)];
      setGap(randomGap);
    } catch (error) {
      console.error('Failed to load knowledge gap:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    if (!gap) return;
    const dismissKey = `${DISMISS_KEY_PREFIX}${gap.id}`;
    const dismissUntil = Date.now() + DISMISS_DURATION_DAYS * 24 * 60 * 60 * 1000;
    localStorage.setItem(dismissKey, dismissUntil.toString());
    setGap(null);
  };

  const handleContribute = () => {
    if (!gap) return;
    // Navigate to import page with gap context
    router.push(`/dashboard/scan?gapId=${gap.id}`);
  };

  if (loading || !gap) return null;

  return (
    <div className="bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-200 rounded-card p-6 hover:border-amber-300 transition-colors">
      {/* Brain icon */}
      <div className="flex items-start gap-4">
        <div className="shrink-0">
          <svg className="w-10 h-10 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold text-amber-900 mb-1">
            Our Sous Chef is looking for...
          </h3>
          <p className="text-base font-semibold text-amber-800 mb-2">
            {gap.request_title}
          </p>
          <p className="text-sm text-amber-700 mb-4">
            {gap.request_body || "Help teach ChefsBook something new and earn double points!"}
          </p>

          <div className="flex items-center gap-3">
            <button
              onClick={handleContribute}
              className="bg-amber-600 text-white px-5 py-2.5 rounded-input text-sm font-semibold hover:bg-amber-700 transition-colors"
            >
              I have one!
            </button>
            <button
              onClick={handleDismiss}
              className="text-amber-600 text-sm font-medium hover:text-amber-700 transition-colors"
            >
              Not now
            </button>
          </div>

          <div className="mt-3 flex items-center gap-1.5 text-xs text-amber-600">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <span className="font-medium">Earn 40 points</span>
            <span className="text-amber-500">·</span>
            <span>2× bonus for gap-filling imports</span>
          </div>
        </div>
      </div>
    </div>
  );
}
