'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@chefsbook/db';
import { ONBOARDING_PAGES } from '@/lib/onboardingContent';
import type { BubbleDef } from '@/lib/onboardingContent';

export function useOnboarding(pageId: string) {
  const [enabled, setEnabled] = useState(false);
  const [seenPages, setSeenPages] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

  const pageDef = ONBOARDING_PAGES.find((p) => p.pageId === pageId);
  const bubbles = pageDef?.bubbles ?? [];
  const showBubbles = enabled && !seenPages.includes(pageId) && bubbles.length > 0;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user?.id;
      if (!uid) return;
      setUserId(uid);
      supabase.from('user_profiles').select('onboarding_enabled, onboarding_seen_pages').eq('id', uid).single().then(({ data: p }) => {
        if (p) {
          setEnabled(p.onboarding_enabled ?? true);
          setSeenPages(p.onboarding_seen_pages ?? []);
        }
      });
    });
  }, []);

  const nextStep = useCallback(() => {
    if (currentStep < bubbles.length - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      // Page complete — mark seen
      const newSeen = [...seenPages, pageId];
      setSeenPages(newSeen);
      setCurrentStep(0);
      if (userId) {
        supabase.from('user_profiles').update({ onboarding_seen_pages: newSeen }).eq('id', userId);
      }
      // Check if all pages seen
      const allPageIds = ONBOARDING_PAGES.map((p) => p.pageId);
      if (allPageIds.every((pid) => newSeen.includes(pid))) {
        setShowCelebration(true);
        if (userId) {
          supabase.from('user_profiles').update({
            onboarding_enabled: false,
            onboarding_completed_at: new Date().toISOString(),
          }).eq('id', userId);
        }
      }
    }
  }, [currentStep, bubbles.length, seenPages, pageId, userId]);

  const dismissOne = useCallback(() => setShowConfirm(true), []);

  const keepOn = useCallback(() => { setShowConfirm(false); nextStep(); }, [nextStep]);

  const turnOff = useCallback(() => {
    setEnabled(false);
    setShowConfirm(false);
    if (userId) {
      supabase.from('user_profiles').update({ onboarding_enabled: false }).eq('id', userId);
    }
  }, [userId]);

  const closeCelebration = useCallback(() => {
    setShowCelebration(false);
    setEnabled(false);
  }, []);

  return {
    showBubbles,
    currentBubble: showBubbles ? bubbles[currentStep] : null,
    currentStep,
    totalSteps: bubbles.length,
    isLastOnPage: currentStep === bubbles.length - 1,
    nextPageLabel: pageDef?.nextPageLabel,
    nextPageHref: pageDef?.nextPageHref,
    nextStep,
    dismissOne,
    showConfirm,
    keepOn,
    turnOff,
    showCelebration,
    closeCelebration,
  };
}
