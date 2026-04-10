'use client';

import { ReactNode } from 'react';

export interface ChefsDialogButton {
  label: string;
  variant: 'primary' | 'secondary' | 'cancel' | 'positive';
  onClick: () => void;
}

interface ChefsDialogProps {
  open: boolean;
  icon?: string;
  title: string;
  body: string | ReactNode;
  buttons: ChefsDialogButton[];
  onClose?: () => void;
}

const VARIANT_CLASSES: Record<ChefsDialogButton['variant'], string> = {
  primary: 'bg-[#ce2b37] text-white hover:opacity-90',
  secondary: 'bg-transparent border-[1.5px] border-[#ce2b37] text-[#ce2b37] hover:bg-red-50',
  cancel: 'bg-transparent border-[1.5px] border-gray-300 text-gray-500 hover:bg-gray-50',
  positive: 'bg-[#009246] text-white hover:opacity-90',
};

export default function ChefsDialog({ open, icon, title, body, buttons, onClose }: ChefsDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />
      {/* Container */}
      <div
        className="relative bg-white rounded-2xl p-6 max-w-[360px] w-[calc(100%-32px)] text-center"
        style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.12)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {icon && <div className="text-[32px] mb-3">{icon}</div>}
        <h3 className="text-lg font-semibold text-[#1a1a1a] mb-2">{title}</h3>
        <div className="text-sm text-gray-500 leading-relaxed mb-6">
          {typeof body === 'string' ? <p>{body}</p> : body}
        </div>
        <div className="flex justify-center gap-3">
          {buttons.map((btn) => (
            <button
              key={btn.label}
              onClick={btn.onClick}
              className={`px-6 py-2.5 rounded-full text-[15px] font-semibold transition-opacity ${VARIANT_CLASSES[btn.variant]}`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
