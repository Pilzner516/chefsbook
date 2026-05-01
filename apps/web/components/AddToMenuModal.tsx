'use client';

import { useEffect, useState } from 'react';
import { supabase, getUserMenus, createMenu, addMenuItem, isRecipeInMenu, getMaxSortOrder } from '@chefsbook/db';
import type { Menu, MenuCourse } from '@chefsbook/db';
import { COURSE_ORDER, COURSE_LABELS } from '@chefsbook/db';
import ChefsDialog from '@/components/ChefsDialog';

interface Props {
  recipeIds: string[];
  open: boolean;
  onClose: () => void;
  onSuccess?: (menuTitle: string, course: string, added: number, skipped: number) => void;
}

export default function AddToMenuModal({ recipeIds, open, onClose, onSuccess }: Props) {
  const [step, setStep] = useState<'menu' | 'course'>('menu');
  const [menus, setMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMenu, setSelectedMenu] = useState<Menu | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<MenuCourse>('main');
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [newMenuTitle, setNewMenuTitle] = useState('');
  const [newMenuOccasion, setNewMenuOccasion] = useState('');
  const [creating, setCreating] = useState(false);
  const [adding, setAdding] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setStep('menu');
      setSelectedMenu(null);
      setSelectedCourse('main');
      setShowNewMenu(false);
      setNewMenuTitle('');
      setNewMenuOccasion('');
      loadMenus();
    }
  }, [open]);

  const loadMenus = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      setUserId(session.user.id);
      const data = await getUserMenus(session.user.id);
      setMenus(data);
    }
    setLoading(false);
  };

  const handleCreateMenu = async () => {
    if (!userId || !newMenuTitle.trim()) return;
    setCreating(true);
    try {
      const menu = await createMenu({
        user_id: userId,
        title: newMenuTitle.trim(),
        occasion: newMenuOccasion || null,
      });
      setMenus((prev) => [menu, ...prev]);
      setSelectedMenu(menu);
      setShowNewMenu(false);
      setNewMenuTitle('');
      setNewMenuOccasion('');
      setStep('course');
    } catch (err) {
      console.error('Failed to create menu:', err);
    }
    setCreating(false);
  };

  const handleSelectMenu = (menu: Menu) => {
    setSelectedMenu(menu);
    setStep('course');
  };

  const handleAddToMenu = async () => {
    if (!selectedMenu) return;
    setAdding(true);

    let added = 0;
    let skipped = 0;

    try {
      for (const recipeId of recipeIds) {
        const exists = await isRecipeInMenu(selectedMenu.id, recipeId, selectedCourse);
        if (exists) {
          skipped++;
          continue;
        }
        const sortOrder = await getMaxSortOrder(selectedMenu.id, selectedCourse);
        await addMenuItem(selectedMenu.id, recipeId, selectedCourse, sortOrder + 1);
        added++;
      }

      onSuccess?.(selectedMenu.title, COURSE_LABELS[selectedCourse], added, skipped);
      onClose();
    } catch (err) {
      console.error('Failed to add to menu:', err);
    }
    setAdding(false);
  };

  const OCCASIONS = [
    { value: '', label: 'None' },
    { value: 'dinner_party', label: 'Dinner Party' },
    { value: 'holiday', label: 'Holiday' },
    { value: 'date_night', label: 'Date Night' },
    { value: 'special_occasion', label: 'Special Occasion' },
    { value: 'everyday', label: 'Everyday' },
  ];

  return (
    <ChefsDialog
      open={open}
      onClose={onClose}
      title={step === 'menu' ? 'Pick a menu' : 'Pick a course'}
    >
      {step === 'menu' ? (
        <div className="space-y-3">
          {loading ? (
            <p className="text-sm text-cb-secondary text-center py-4">Loading menus...</p>
          ) : showNewMenu ? (
            <div className="space-y-3">
              <input
                type="text"
                value={newMenuTitle}
                onChange={(e) => setNewMenuTitle(e.target.value.slice(0, 80))}
                placeholder="Menu title..."
                className="w-full border border-cb-border rounded-input px-3 py-2 text-sm"
                autoFocus
              />
              <select
                value={newMenuOccasion}
                onChange={(e) => setNewMenuOccasion(e.target.value)}
                className="w-full border border-cb-border rounded-input px-3 py-2 text-sm"
              >
                {OCCASIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowNewMenu(false)}
                  className="flex-1 px-3 py-2 border border-cb-border rounded-input text-sm text-cb-secondary hover:bg-cb-bg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateMenu}
                  disabled={creating || !newMenuTitle.trim()}
                  className="flex-1 px-3 py-2 bg-cb-primary text-white rounded-input text-sm font-semibold disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>
          ) : (
            <>
              {menus.length > 0 && (
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {menus.map((menu) => (
                    <button
                      key={menu.id}
                      onClick={() => handleSelectMenu(menu)}
                      className="w-full text-left px-3 py-2 border border-cb-border rounded-input hover:border-cb-primary transition flex items-center justify-between"
                    >
                      <div>
                        <span className="font-medium text-cb-text">{menu.title}</span>
                        {menu.occasion && (
                          <span className="ml-2 text-xs text-cb-secondary bg-cb-bg px-2 py-0.5 rounded-full">
                            {menu.occasion.replace(/_/g, ' ')}
                          </span>
                        )}
                      </div>
                      <svg className="w-4 h-4 text-cb-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                      </svg>
                    </button>
                  ))}
                </div>
              )}
              <button
                onClick={() => setShowNewMenu(true)}
                className="w-full px-3 py-2 border border-dashed border-cb-border rounded-input text-sm text-cb-primary hover:border-cb-primary transition flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Create new menu
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-cb-secondary mb-3">
            Adding to <span className="font-medium text-cb-text">{selectedMenu?.title}</span>
          </p>
          <div className="grid grid-cols-3 gap-2">
            {COURSE_ORDER.map((course) => (
              <button
                key={course}
                onClick={() => setSelectedCourse(course)}
                className={`px-3 py-2 rounded-input text-sm font-medium transition ${
                  selectedCourse === course
                    ? 'bg-cb-primary text-white'
                    : 'bg-cb-bg text-cb-text hover:bg-cb-primary/10'
                }`}
              >
                {COURSE_LABELS[course]}
              </button>
            ))}
          </div>
          {recipeIds.length > 1 && (
            <p className="text-xs text-cb-secondary mt-2">
              All {recipeIds.length} recipes will be added to this course. You can reassign individual courses from the menu.
            </p>
          )}
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => setStep('menu')}
              className="flex-1 px-4 py-2 border border-cb-border rounded-input text-sm font-medium text-cb-secondary hover:bg-cb-bg transition"
            >
              Back
            </button>
            <button
              onClick={handleAddToMenu}
              disabled={adding}
              className="flex-1 px-4 py-2 bg-cb-primary text-white rounded-input text-sm font-semibold hover:opacity-90 transition disabled:opacity-50"
            >
              {adding ? 'Adding...' : 'Add to Menu'}
            </button>
          </div>
        </div>
      )}
    </ChefsDialog>
  );
}
