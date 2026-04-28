'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@chefsbook/db';

interface CookbookTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string;
  preview_image_url: string | null;
  is_active: boolean;
  is_premium: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

const CATEGORIES = ['All', 'Classic', 'Modern', 'Minimal', 'Holiday', 'Kids', 'BBQ', 'Seasonal'];

export default function AdminCookbookTemplatesPage() {
  const [templates, setTemplates] = useState<CookbookTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<CookbookTemplate>>({});

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError('Not authenticated');
        return;
      }

      const res = await fetch('/api/admin/cookbook-templates', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to load templates');
      }

      const data = await res.json();
      setTemplates(data.templates || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggleActive = async (template: CookbookTemplate) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const res = await fetch(`/api/admin/cookbook-templates/${template.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ is_active: !template.is_active }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update template');
      }

      setTemplates((prev) =>
        prev.map((t) =>
          t.id === template.id ? { ...t, is_active: !t.is_active } : t
        )
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    }
  };

  const startEdit = (template: CookbookTemplate) => {
    setEditingId(template.id);
    setEditForm({
      name: template.name,
      description: template.description || '',
      category: template.category,
      sort_order: template.sort_order,
      is_premium: template.is_premium,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = async () => {
    if (!editingId) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const res = await fetch(`/api/admin/cookbook-templates/${editingId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(editForm),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update template');
      }

      const { template } = await res.json();
      setTemplates((prev) =>
        prev.map((t) => (t.id === editingId ? template : t))
      );
      setEditingId(null);
      setEditForm({});
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    }
  };

  const filteredTemplates =
    categoryFilter === 'All'
      ? templates
      : templates.filter((t) => t.category === categoryFilter);

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Cookbook Templates</h1>
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Cookbook Templates</h1>
        <span className="text-sm text-gray-500">{templates.length} templates</span>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-2 rounded mb-4">
          {error}
        </div>
      )}

      {/* Category filter tabs */}
      <div className="flex gap-1 mb-6 flex-wrap">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
              categoryFilter === cat
                ? 'bg-cb-primary text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Templates table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Template</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Category</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Sort</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Premium</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Active</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredTemplates.map((template) => (
              <tr key={template.id} className={!template.is_active ? 'bg-gray-50 opacity-60' : ''}>
                <td className="px-4 py-3">
                  {editingId === template.id ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={editForm.name || ''}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        placeholder="Name"
                      />
                      <textarea
                        value={editForm.description || ''}
                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        placeholder="Description"
                        rows={2}
                      />
                    </div>
                  ) : (
                    <div>
                      <p className="font-medium text-gray-900">{template.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{template.description}</p>
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  {editingId === template.id ? (
                    <select
                      value={editForm.category || ''}
                      onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                      className="px-2 py-1 border border-gray-300 rounded text-sm"
                    >
                      {CATEGORIES.filter((c) => c !== 'All').map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">{template.category}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {editingId === template.id ? (
                    <input
                      type="number"
                      value={editForm.sort_order || 0}
                      onChange={(e) => setEditForm({ ...editForm, sort_order: parseInt(e.target.value) || 0 })}
                      className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                  ) : (
                    <span className="text-gray-500">{template.sort_order}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  {editingId === template.id ? (
                    <input
                      type="checkbox"
                      checked={editForm.is_premium || false}
                      onChange={(e) => setEditForm({ ...editForm, is_premium: e.target.checked })}
                      className="rounded"
                    />
                  ) : template.is_premium ? (
                    <span className="text-amber-600">$</span>
                  ) : (
                    <span className="text-gray-300">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => toggleActive(template)}
                    className={`w-10 h-5 rounded-full relative transition ${
                      template.is_active ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                        template.is_active ? 'right-0.5' : 'left-0.5'
                      }`}
                    />
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  {editingId === template.id ? (
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={saveEdit}
                        className="px-2 py-1 bg-cb-primary text-white rounded text-xs font-medium"
                      >
                        Save
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="px-2 py-1 text-gray-500 hover:text-gray-700 text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => startEdit(template)}
                      className="px-2 py-1 text-cb-primary hover:underline text-xs"
                    >
                      Edit
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredTemplates.length === 0 && (
        <p className="text-center text-gray-500 py-8">No templates in this category.</p>
      )}
    </div>
  );
}
