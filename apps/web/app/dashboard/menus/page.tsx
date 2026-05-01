'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase, getUserMenus, createMenu, deleteMenu } from '@chefsbook/db';
import type { Menu } from '@chefsbook/db';
import { useConfirmDialog } from '@/components/useConfirmDialog';
import ChefsDialog from '@/components/ChefsDialog';

const OCCASIONS = [
  { value: '', label: 'None' },
  { value: 'dinner_party', label: 'Dinner Party' },
  { value: 'holiday', label: 'Holiday' },
  { value: 'date_night', label: 'Date Night' },
  { value: 'special_occasion', label: 'Special Occasion' },
  { value: 'everyday', label: 'Everyday' },
  { value: 'custom', label: 'Custom' },
];

function relativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export default function MenusPage() {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createOccasion, setCreateOccasion] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createNotes, setCreateNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirm, ConfirmDialog] = useConfirmDialog();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUserId(session.user.id);
        loadMenus(session.user.id);
      }
    });
  }, []);

  const loadMenus = async (uid: string) => {
    setLoading(true);
    try {
      const data = await getUserMenus(uid);
      setMenus(data);
    } catch (err) {
      console.error('Failed to load menus:', err);
    }
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!userId || !createTitle.trim()) return;
    setSaving(true);
    try {
      await createMenu({
        user_id: userId,
        title: createTitle.trim(),
        occasion: createOccasion || null,
        description: createDescription.trim() || null,
        notes: createNotes.trim() || null,
      });
      setShowCreate(false);
      setCreateTitle('');
      setCreateOccasion('');
      setCreateDescription('');
      setCreateNotes('');
      loadMenus(userId);
    } catch (err) {
      console.error('Failed to create menu:', err);
    }
    setSaving(false);
  };

  const handleDelete = async (menuId: string) => {
    const ok = await confirm({
      title: 'Delete menu?',
      body: 'This cannot be undone.',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
    });
    if (!ok) return;
    try {
      await deleteMenu(menuId);
      if (userId) loadMenus(userId);
    } catch (err) {
      console.error('Failed to delete menu:', err);
    }
  };

  const getOccasionLabel = (value: string | null) => {
    if (!value) return null;
    return OCCASIONS.find((o) => o.value === value)?.label ?? value;
  };

  if (loading) {
    return (
      <div className="p-8">
        <p className="text-cb-secondary">Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-cb-text">My Menus</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-cb-primary text-white px-4 py-2 rounded-input text-sm font-semibold hover:opacity-90 transition flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New Menu
        </button>
      </div>

      {menus.length === 0 ? (
        <div className="bg-cb-card border border-cb-border rounded-card p-12 text-center">
          <svg className="w-16 h-16 mx-auto text-cb-muted mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
          </svg>
          <h2 className="text-xl font-bold text-cb-text mb-2">Your Menus</h2>
          <p className="text-cb-secondary mb-6 max-w-md mx-auto">
            Plan a dinner party, holiday feast, or date night. Build a menu course by course from your recipes.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="bg-cb-primary text-white px-6 py-3 rounded-input font-semibold hover:opacity-90 transition"
          >
            Create your first menu
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {menus.map((menu) => (
            <Link
              key={menu.id}
              href={`/dashboard/menus/${menu.id}`}
              className="bg-cb-card border border-cb-border rounded-card p-4 hover:border-cb-primary transition group"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-cb-text group-hover:text-cb-primary transition truncate">
                    {menu.title}
                  </h3>
                  {menu.occasion && (
                    <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium bg-cb-primary-soft text-cb-primary">
                      {getOccasionLabel(menu.occasion)}
                    </span>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDelete(menu.id);
                  }}
                  className="text-cb-muted hover:text-red-500 transition p-1"
                  title="Delete menu"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                  </svg>
                </button>
              </div>
              {menu.description && (
                <p className="text-sm text-cb-secondary mt-2 line-clamp-2">{menu.description}</p>
              )}
              <p className="text-xs text-cb-muted mt-3">{relativeTime(menu.updated_at)}</p>
            </Link>
          ))}
        </div>
      )}

      <ChefsDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create Menu"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-cb-text mb-1">Title *</label>
            <input
              type="text"
              value={createTitle}
              onChange={(e) => setCreateTitle(e.target.value.slice(0, 80))}
              placeholder="e.g., Thanksgiving Dinner"
              className="w-full border border-cb-border rounded-input px-3 py-2 text-sm"
              maxLength={80}
            />
            <p className="text-xs text-cb-muted mt-1">{createTitle.length}/80</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-cb-text mb-1">Occasion</label>
            <select
              value={createOccasion}
              onChange={(e) => setCreateOccasion(e.target.value)}
              className="w-full border border-cb-border rounded-input px-3 py-2 text-sm"
            >
              {OCCASIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-cb-text mb-1">Description</label>
            <textarea
              value={createDescription}
              onChange={(e) => setCreateDescription(e.target.value.slice(0, 200))}
              placeholder="Optional description..."
              rows={2}
              className="w-full border border-cb-border rounded-input px-3 py-2 text-sm resize-none"
              maxLength={200}
            />
            <p className="text-xs text-cb-muted mt-1">{createDescription.length}/200</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-cb-text mb-1">Notes (private)</label>
            <textarea
              value={createNotes}
              onChange={(e) => setCreateNotes(e.target.value)}
              placeholder="e.g., make the risotto first..."
              rows={2}
              className="w-full border border-cb-border rounded-input px-3 py-2 text-sm resize-none"
            />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button
            onClick={() => setShowCreate(false)}
            className="flex-1 px-4 py-2 border border-cb-border rounded-input text-sm font-medium text-cb-secondary hover:bg-cb-bg transition"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={saving || !createTitle.trim()}
            className="flex-1 px-4 py-2 bg-cb-primary text-white rounded-input text-sm font-semibold hover:opacity-90 transition disabled:opacity-50"
          >
            {saving ? 'Creating...' : 'Create'}
          </button>
        </div>
      </ChefsDialog>

      <ConfirmDialog />
    </div>
  );
}
