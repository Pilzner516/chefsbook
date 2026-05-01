'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { supabase, getUserMenus, createMenu, deleteMenu, updateMenu, getMenuRecipeImages } from '@chefsbook/db';
import type { Menu } from '@chefsbook/db';
import { useConfirmDialog } from '@/components/useConfirmDialog';
import ChefsDialog from '@/components/ChefsDialog';
import { proxyIfNeeded, CHEFS_HAT_URL } from '@/lib/recipeImage';

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

  const [editMenu, setEditMenu] = useState<Menu | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editOccasion, setEditOccasion] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editCoverUrl, setEditCoverUrl] = useState<string | null>(null);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [recipeImages, setRecipeImages] = useState<{ recipe_id: string; recipe_title: string; photos: { url: string; is_primary: boolean }[] }[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const openEditModal = async (menu: Menu, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditMenu(menu);
    setEditTitle(menu.title);
    setEditOccasion(menu.occasion ?? '');
    setEditDescription(menu.description ?? '');
    setEditNotes(menu.notes ?? '');
    setEditCoverUrl(menu.cover_image_url);
    setShowImagePicker(false);
    setRecipeImages([]);
  };

  const handleEdit = async () => {
    if (!editMenu || !editTitle.trim()) return;
    setSaving(true);
    try {
      await updateMenu(editMenu.id, {
        title: editTitle.trim(),
        occasion: editOccasion || null,
        description: editDescription.trim() || null,
        notes: editNotes.trim() || null,
        cover_image_url: editCoverUrl,
      });
      setEditMenu(null);
      if (userId) loadMenus(userId);
    } catch (err) {
      console.error('Failed to update menu:', err);
    }
    setSaving(false);
  };

  const loadRecipeImages = async () => {
    if (!editMenu) return;
    setLoadingImages(true);
    try {
      const images = await getMenuRecipeImages(editMenu.id);
      setRecipeImages(images);
    } catch (err) {
      console.error('Failed to load recipe images:', err);
    }
    setLoadingImages(false);
  };

  const handleChooseFromRecipes = () => {
    setShowImagePicker(true);
    loadRecipeImages();
  };

  const handleSelectRecipeImage = (url: string) => {
    setEditCoverUrl(url);
    setShowImagePicker(false);
  };

  const handleUploadImage = async (file: File) => {
    if (!editMenu) return;
    setUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const fileName = `${editMenu.id}/cover-${Date.now()}.jpg`;
      const { error } = await supabase.storage
        .from('menu-covers')
        .upload(fileName, file, { upsert: true });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('menu-covers')
        .getPublicUrl(fileName);

      setEditCoverUrl(publicUrl);
    } catch (err) {
      console.error('Upload failed:', err);
    }
    setUploading(false);
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
              className="bg-cb-card border border-cb-border rounded-card overflow-hidden hover:border-cb-primary transition group"
            >
              {/* Cover image area */}
              <div className="h-32 bg-cb-bg overflow-hidden flex items-center justify-center relative">
                {menu.cover_image_url ? (
                  <img
                    src={proxyIfNeeded(menu.cover_image_url)}
                    alt={menu.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-cb-muted">
                    <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.166C6.845 8.51 6 9.473 6 10.608v2.513m6-4.87c1.355 0 2.697.055 4.024.165C17.155 8.51 18 9.473 18 10.608v2.513m-3-4.87v-1.5m-6 1.5v-1.5m12 9.75-1.5.75a3.354 3.354 0 0 1-3 0 3.354 3.354 0 0 0-3 0 3.354 3.354 0 0 1-3 0 3.354 3.354 0 0 0-3 0 3.354 3.354 0 0 1-3 0L3 16.5m15-3.38a48.474 48.474 0 0 0-6-.37c-2.032 0-4.034.125-6 .37m12 0c.39.049.777.102 1.163.16 1.07.16 1.837 1.094 1.837 2.175v5.17c0 .62-.504 1.124-1.125 1.124H4.125A1.125 1.125 0 0 1 3 20.625v-5.17c0-1.08.768-2.014 1.837-2.174A47.78 47.78 0 0 1 6 13.12" />
                    </svg>
                  </div>
                )}
              </div>

              <div className="p-4">
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
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => openEditModal(menu, e)}
                      className="text-cb-muted hover:text-cb-primary transition p-1"
                      title="Edit menu"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                      </svg>
                    </button>
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
                </div>
                {menu.description && (
                  <p className="text-sm text-cb-secondary mt-2 line-clamp-2">{menu.description}</p>
                )}
                <p className="text-xs text-cb-muted mt-3">{relativeTime(menu.updated_at)}</p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Create Menu Modal */}
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

      {/* Edit Menu Modal */}
      <ChefsDialog
        open={!!editMenu}
        onClose={() => setEditMenu(null)}
        title="Edit Menu"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-cb-text mb-1">Title *</label>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value.slice(0, 80))}
              placeholder="e.g., Thanksgiving Dinner"
              className="w-full border border-cb-border rounded-input px-3 py-2 text-sm"
              maxLength={80}
            />
            <p className="text-xs text-cb-muted mt-1">{editTitle.length}/80</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-cb-text mb-1">Occasion</label>
            <select
              value={editOccasion}
              onChange={(e) => setEditOccasion(e.target.value)}
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
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value.slice(0, 200))}
              placeholder="Optional description..."
              rows={2}
              className="w-full border border-cb-border rounded-input px-3 py-2 text-sm resize-none"
              maxLength={200}
            />
            <p className="text-xs text-cb-muted mt-1">{editDescription.length}/200</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-cb-text mb-1">Notes (private)</label>
            <textarea
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              placeholder="e.g., make the risotto first..."
              rows={2}
              className="w-full border border-cb-border rounded-input px-3 py-2 text-sm resize-none"
            />
          </div>

          {/* Cover Image Section */}
          <div>
            <label className="block text-sm font-medium text-cb-text mb-2">Cover Image</label>
            {editCoverUrl && (
              <div className="mb-3 relative inline-block">
                <img
                  src={proxyIfNeeded(editCoverUrl)}
                  alt="Cover preview"
                  className="w-24 h-24 object-cover rounded-input border border-cb-border"
                />
                <button
                  onClick={() => setEditCoverUrl(null)}
                  className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs"
                >
                  ×
                </button>
              </div>
            )}
            {!showImagePicker ? (
              <div className="flex gap-2">
                <button
                  onClick={handleChooseFromRecipes}
                  className="flex-1 px-3 py-2 border border-cb-border rounded-input text-sm text-cb-text hover:border-cb-primary transition flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                  </svg>
                  Choose from recipes
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex-1 px-3 py-2 border border-cb-border rounded-input text-sm text-cb-text hover:border-cb-primary transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                  </svg>
                  {uploading ? 'Uploading...' : 'Upload image'}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUploadImage(file);
                    e.target.value = '';
                  }}
                />
              </div>
            ) : (
              <div className="border border-cb-border rounded-input p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-cb-text">Select from recipe photos</span>
                  <button
                    onClick={() => setShowImagePicker(false)}
                    className="text-cb-muted hover:text-cb-text text-sm"
                  >
                    Cancel
                  </button>
                </div>
                {loadingImages ? (
                  <p className="text-sm text-cb-secondary py-4 text-center">Loading images...</p>
                ) : recipeImages.length === 0 ? (
                  <p className="text-sm text-cb-secondary py-4 text-center">
                    Add recipes to your menu first to choose from their photos.
                  </p>
                ) : (
                  <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                    {recipeImages.flatMap((ri) =>
                      ri.photos.map((photo, idx) => (
                        <button
                          key={`${ri.recipe_id}-${idx}`}
                          onClick={() => handleSelectRecipeImage(photo.url)}
                          className="aspect-square rounded-input overflow-hidden border-2 border-transparent hover:border-cb-primary transition"
                          title={ri.recipe_title}
                        >
                          <img
                            src={proxyIfNeeded(photo.url)}
                            alt={ri.recipe_title}
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button
            onClick={() => setEditMenu(null)}
            className="flex-1 px-4 py-2 border border-cb-border rounded-input text-sm font-medium text-cb-secondary hover:bg-cb-bg transition"
          >
            Cancel
          </button>
          <button
            onClick={handleEdit}
            disabled={saving || !editTitle.trim()}
            className="flex-1 px-4 py-2 bg-cb-primary text-white rounded-input text-sm font-semibold hover:opacity-90 transition disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </ChefsDialog>

      <ConfirmDialog />
    </div>
  );
}
