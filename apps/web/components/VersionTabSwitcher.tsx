'use client';

import { useState } from 'react';
import type { RecipeWithDetails } from '@chefsbook/db';

interface VersionTabSwitcherProps {
  original: RecipeWithDetails;
  versions: RecipeWithDetails[];
  currentVersionId: string | null;
  onVersionChange: (versionId: string | null) => void;
  onRename: (versionId: string, newTitle: string) => Promise<void>;
  onDelete: (versionId: string) => Promise<void>;
  onPromote: (versionId: string) => Promise<void>;
  canCreateMore: boolean;
}

export function VersionTabSwitcher({
  original,
  versions,
  currentVersionId,
  onVersionChange,
  onRename,
  onDelete,
  onPromote,
  canCreateMore,
}: VersionTabSwitcherProps) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [showMenuFor, setShowMenuFor] = useState<string | null>(null);

  const isOriginal = currentVersionId === null;
  const v1 = versions.find(v => v.personal_version_slot === 1);
  const v2 = versions.find(v => v.personal_version_slot === 2);

  const handleRenameStart = (version: RecipeWithDetails) => {
    setRenamingId(version.id);
    setRenameValue(version.title);
    setShowMenuFor(null);
  };

  const handleRenameSave = async (versionId: string) => {
    if (renameValue.trim()) {
      await onRename(versionId, renameValue.trim());
    }
    setRenamingId(null);
  };

  const renderVersionTab = (version: RecipeWithDetails | undefined, slot: number) => {
    if (!version) return null;

    const isCurrent = currentVersionId === version.id;
    const isRenaming = renamingId === version.id;

    return (
      <div key={version.id} className="relative inline-flex items-center gap-1">
        <button
          onClick={() => !isRenaming && onVersionChange(version.id)}
          className={`
            px-4 py-2 rounded-t-lg border-b-2 transition-all text-sm font-medium
            ${isCurrent
              ? 'border-cb-primary text-cb-primary bg-white'
              : 'border-transparent text-cb-secondary hover:text-cb-text hover:bg-cb-base'
            }
          `}
        >
          {isRenaming ? (
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={() => handleRenameSave(version.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameSave(version.id);
                if (e.key === 'Escape') setRenamingId(null);
              }}
              className="w-32 px-2 py-1 border border-cb-border rounded bg-white text-cb-text"
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            version.title
          )}
        </button>

        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenuFor(showMenuFor === version.id ? null : version.id);
            }}
            className="p-1 text-cb-secondary hover:text-cb-text"
            aria-label="Version options"
          >
            ···
          </button>

          {showMenuFor === version.id && (
            <div className="absolute top-full right-0 mt-1 w-48 bg-white border border-cb-border rounded-lg shadow-lg z-50">
              <button
                onClick={() => handleRenameStart(version)}
                className="w-full px-4 py-2 text-left text-sm hover:bg-cb-base text-cb-text"
              >
                Rename
              </button>
              <button
                onClick={() => {
                  setShowMenuFor(null);
                  onPromote(version.id);
                }}
                className="w-full px-4 py-2 text-left text-sm hover:bg-cb-base text-cb-text"
              >
                Save as My Recipe
              </button>
              <button
                onClick={() => {
                  setShowMenuFor(null);
                  onDelete(version.id);
                }}
                className="w-full px-4 py-2 text-left text-sm hover:bg-cb-base text-red-600"
              >
                Delete Version
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex items-center gap-4 border-b border-cb-border mb-6">
      <button
        onClick={() => onVersionChange(null)}
        className={`
          px-4 py-2 rounded-t-lg border-b-2 transition-all text-sm font-medium
          ${isOriginal
            ? 'border-cb-primary text-cb-primary bg-white'
            : 'border-transparent text-cb-secondary hover:text-cb-text hover:bg-cb-base'
          }
        `}
      >
        Original
      </button>

      {renderVersionTab(v1, 1)}
      {renderVersionTab(v2, 2)}
    </div>
  );
}
