'use client';

import { useEffect } from 'react';
import { useOnboarding } from '@/hooks/useOnboarding';
import OnboardingBubble from './OnboardingBubble';
import ChefsDialog from './ChefsDialog';

export default function OnboardingOverlay({ pageId }: { pageId: string }) {
  const {
    showBubbles, currentBubble, currentStep, totalSteps, isLastOnPage,
    nextPageLabel, nextStep, dismissOne, showConfirm, keepOn, turnOff,
    showCelebration, closeCelebration,
  } = useOnboarding(pageId);

  // Auto-skip bubbles whose target doesn't exist; scroll target into view
  useEffect(() => {
    if (!showBubbles || !currentBubble) return;
    const el = document.querySelector(currentBubble.target);
    if (!el) {
      // Target not mounted — skip to next step after a brief delay
      const timer = setTimeout(nextStep, 50);
      return () => clearTimeout(timer);
    }
    // Scroll target into view before positioning the bubble
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showBubbles, currentBubble?.target, currentStep]);

  return (
    <>
      {showBubbles && currentBubble && (
        <OnboardingBubble
          target={currentBubble.target}
          title={currentBubble.title}
          body={currentBubble.body}
          position={currentBubble.position}
          step={currentStep}
          totalSteps={totalSteps}
          isLastOnPage={isLastOnPage}
          nextPageLabel={nextPageLabel}
          showConfirm={showConfirm}
          onNext={nextStep}
          onDismiss={dismissOne}
          onKeepOn={keepOn}
          onTurnOff={turnOff}
        />
      )}

      <ChefsDialog
        open={showCelebration}
        icon="🎉"
        title="You're all set!"
        body="You've explored all of ChefsBook. Help tips are now off — you can turn them on again in Settings."
        onClose={closeCelebration}
        buttons={[{ label: 'Start Cooking →', variant: 'positive', onClick: closeCelebration }]}
      />
    </>
  );
}
