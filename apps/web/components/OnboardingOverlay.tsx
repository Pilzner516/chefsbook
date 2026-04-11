'use client';

import { useOnboarding } from '@/hooks/useOnboarding';
import OnboardingBubble from './OnboardingBubble';
import ChefsDialog from './ChefsDialog';

export default function OnboardingOverlay({ pageId }: { pageId: string }) {
  const {
    showBubbles, currentBubble, currentStep, totalSteps, isLastOnPage,
    nextPageLabel, nextStep, dismissOne, showConfirm, keepOn, turnOff,
    showCelebration, closeCelebration,
  } = useOnboarding(pageId);

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
