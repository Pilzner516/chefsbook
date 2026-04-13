'use client';

import { useRef, useState, useEffect } from 'react';
import { useFloating, offset, flip, shift, arrow, FloatingArrow } from '@floating-ui/react';
import type { Placement } from '@floating-ui/react';

interface Props {
  target: string;
  title: string;
  body: string;
  position: 'top' | 'bottom' | 'left' | 'right';
  step: number;
  totalSteps: number;
  isLastOnPage: boolean;
  nextPageLabel?: string;
  showConfirm: boolean;
  onNext: () => void;
  onDismiss: () => void;
  onKeepOn: () => void;
  onTurnOff: () => void;
}

export default function OnboardingBubble({
  target, title, body, position, step, totalSteps,
  isLastOnPage, nextPageLabel, showConfirm,
  onNext, onDismiss, onKeepOn, onTurnOff,
}: Props) {
  const arrowRef = useRef(null);
  const [targetEl, setTargetEl] = useState<Element | null>(null);

  useEffect(() => {
    const el = document.querySelector(target);
    setTargetEl(el);
  }, [target]);

  const { refs, floatingStyles, context } = useFloating({
    placement: position as Placement,
    elements: { reference: targetEl },
    middleware: [offset(12), flip(), shift({ padding: 16 }), arrow({ element: arrowRef })],
  });

  if (!targetEl) return null;

  return (
    <div ref={refs.setFloating} style={{ ...floatingStyles, zIndex: 9999 }} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="bg-white rounded-xl p-5 max-w-[320px] relative" style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.15)' }}>
        <FloatingArrow ref={arrowRef} context={context} fill="white" />

        {showConfirm ? (
          /* Dismiss confirmation */
          <div>
            <h4 className="text-base font-semibold text-gray-900 mb-2">Keep help bubbles on?</h4>
            <p className="text-sm text-gray-500 mb-4">You can always turn them back on in Settings.</p>
            <div className="flex gap-2">
              <button onClick={onKeepOn} className="flex-1 py-2 rounded-full text-sm font-semibold border border-gray-300 text-gray-600 hover:bg-gray-50">Keep On</button>
              <button onClick={onTurnOff} className="flex-1 py-2 rounded-full text-sm font-semibold bg-[#ce2b37] text-white hover:opacity-90">Turn Off</button>
            </div>
          </div>
        ) : (
          /* Normal bubble */
          <div>
            <div className="flex items-start justify-between gap-2 mb-2">
              <h4 className="text-base font-semibold text-gray-900">{title}</h4>
              <button onClick={onTurnOff} className="text-gray-400 hover:text-gray-600 text-lg leading-none shrink-0">✕</button>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed mb-3">{body}</p>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-gray-400">Step {step + 1} of {totalSteps}</span>
              <button onClick={onTurnOff} className="text-xs text-gray-400 hover:text-gray-600">Turn off tips</button>
            </div>
            <button onClick={onNext} className="w-full py-2 rounded-full text-sm font-semibold bg-[#ce2b37] text-white hover:opacity-90">
              {isLastOnPage ? (nextPageLabel ?? 'Got it!') : 'Got it'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
