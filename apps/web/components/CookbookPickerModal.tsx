'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Link from 'next/link';

interface PrintedCookbook {
  id: string;
  title: string;
  recipe_ids: string[];
}

interface CookbookPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  cookbooks: PrintedCookbook[];
  recipeCount: number;
  onSelect: (cookbookId: string) => void;
  loading: boolean;
}

export function CookbookPickerModal({
  isOpen,
  onClose,
  cookbooks,
  recipeCount,
  onSelect,
  loading,
}: CookbookPickerModalProps) {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (selectedId) {
      onSelect(selectedId);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-cb-card rounded-card shadow-xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-cb-border">
          <h2 className="text-lg font-semibold">
            {t('menuBooks.selectCookbook', 'Select Cookbook')}
          </h2>
        </div>

        {/* Content */}
        <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
          {cookbooks.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-cb-secondary mb-4">
                {t('menuBooks.noCookbooksYet', "You don't have a cookbook yet. Create one first in Print Cookbook.")}
              </p>
              <Link
                href="/dashboard/print-cookbook"
                className="text-cb-primary hover:underline"
              >
                Go to Print Cookbook
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {cookbooks.map((cookbook) => (
                <button
                  key={cookbook.id}
                  onClick={() => setSelectedId(cookbook.id)}
                  className={`w-full text-left px-4 py-3 rounded-input border transition-colors ${
                    selectedId === cookbook.id
                      ? 'border-cb-primary bg-cb-primary/5'
                      : 'border-cb-border hover:border-cb-primary/50'
                  }`}
                >
                  <p className="font-medium">{cookbook.title || 'Untitled Cookbook'}</p>
                  <p className="text-sm text-cb-secondary">
                    {cookbook.recipe_ids?.length || 0} recipes
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {cookbooks.length > 0 && (
          <div className="px-6 py-4 border-t border-cb-border flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-cb-secondary hover:text-cb-text transition-colors"
            >
              {t('common.cancel', 'Cancel')}
            </button>
            <button
              onClick={handleConfirm}
              disabled={!selectedId || loading}
              className="px-4 py-2 bg-cb-primary text-white rounded-input font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Adding...
                </span>
              ) : (
                t('menuBooks.addRecipes', 'Add {{count}} Recipes').replace('{{count}}', String(recipeCount))
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
