'use client';

import { useState } from 'react';
import { IMAGE_THEMES } from '@chefsbook/ai';
import type { ImageTheme } from '@chefsbook/ai';

interface Props {
  currentTheme: ImageTheme;
  onSave: (theme: ImageTheme) => void;
  onClose: () => void;
}

const THEME_LIST = Object.values(IMAGE_THEMES);

export default function ThemePickerModal({ currentTheme, onSave, onClose }: Props) {
  const [selected, setSelected] = useState<ImageTheme>(currentTheme);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    onSave(selected);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-lg w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-gray-900 mb-1">Choose Your Image Theme</h2>
        <p className="text-sm text-gray-500 mb-4">Applied to all future AI-generated recipe images</p>

        <div className="grid grid-cols-2 gap-3 mb-4">
          {THEME_LIST.map((theme) => {
            const isSelected = selected === theme.id;
            return (
              <button
                key={theme.id}
                onClick={() => setSelected(theme.id)}
                className={`relative rounded-xl border-2 overflow-hidden text-left transition-all ${
                  isSelected
                    ? 'border-cb-primary ring-2 ring-cb-primary/20'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <img
                  src={theme.previewImage}
                  alt={theme.name}
                  className="w-full h-32 object-cover"
                  loading="lazy"
                />
                <div className="p-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">{theme.emoji}</span>
                    <span className="text-sm font-semibold text-gray-900">{theme.name}</span>
                    {isSelected && (
                      <span className="ml-auto text-cb-primary text-xs font-bold">&#10003;</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{theme.description}</p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 pt-4">
          <p className="text-xs text-gray-500">
            Currently: {IMAGE_THEMES[currentTheme]?.emoji} {IMAGE_THEMES[currentTheme]?.name}
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || selected === currentTheme}
              className="px-4 py-2 text-sm font-semibold text-white bg-cb-primary rounded-md hover:opacity-90 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Theme'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
