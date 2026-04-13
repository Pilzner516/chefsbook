'use client';

import { useEffect, useState } from 'react';
import { supabase, listCookbooks, listRecipes, createCookbook } from '@chefsbook/db';
import type { Cookbook, Recipe } from '@chefsbook/db';
import Link from 'next/link';
import { proxyIfNeeded } from '@/lib/recipeImage';

export default function CookbooksPage() {
  const [cookbooks, setCookbooks] = useState<Cookbook[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Recipe[]>([]);
  const [searching, setSearching] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [isbnLooking, setIsbnLooking] = useState(false);
  const [form, setForm] = useState({
    title: '',
    author: '',
    publisher: '',
    year: '',
    isbn: '',
    location: '',
    notes: '',
    cover_url: '',
    description: '',
    google_books_id: '',
  });

  useEffect(() => {
    loadCookbooks();
  }, []);

  const loadCookbooks = async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const data = await listCookbooks(user.id);
      setCookbooks(data);
    }
    setLoading(false);
  };

  const handleSaveCookbook = async () => {
    if (!form.title.trim()) {
      setFormError('Title is required');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');
      await createCookbook(user.id, {
        title: form.title.trim(),
        author: form.author.trim() || null,
        publisher: form.publisher.trim() || null,
        year: form.year ? parseInt(form.year, 10) : null,
        isbn: form.isbn.trim() || null,
        location: form.location.trim() || null,
        notes: form.notes.trim() || null,
        cover_url: form.cover_url || null,
        google_books_id: form.google_books_id || null,
        description: form.description || null,
        rating: null,
        total_recipes: null,
        toc_fetched: false,
        toc_fetched_at: null,
        visibility: 'private',
      });
      setShowModal(false);
      setForm({ title: '', author: '', publisher: '', year: '', isbn: '', location: '', notes: '', cover_url: '', description: '', google_books_id: '' });
      await loadCookbooks();
    } catch (e: any) {
      setFormError(e.message);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!search.trim()) {
      setSearchResults([]);
      return;
    }
    const timeout = setTimeout(() => searchByIngredient(search), 400);
    return () => clearTimeout(timeout);
  }, [search]);

  const lookupIsbn = async () => {
    if (!form.isbn.trim()) return;
    setIsbnLooking(true);
    setFormError('');
    try {
      const res = await fetch('/api/cookbooks/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isbn: form.isbn.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setFormError(data.error || 'Book not found'); return; }
      setForm((prev) => ({
        ...prev,
        title: data.title || prev.title,
        author: data.author || prev.author,
        publisher: data.publisher || prev.publisher,
        year: data.year ? String(data.year) : prev.year,
        cover_url: data.coverUrl || prev.cover_url,
        description: data.description || prev.description,
        google_books_id: data.googleBooksId || prev.google_books_id,
      }));
    } catch (e: any) {
      setFormError(e.message);
    } finally {
      setIsbnLooking(false);
    }
  };

  const searchByIngredient = async (query: string) => {
    setSearching(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const recipes = await listRecipes({ userId: user.id, search: query });
      const fromCookbooks = recipes.filter((r) => r.source_type === 'cookbook' && r.cookbook_id);
      setSearchResults(fromCookbooks);
    }
    setSearching(false);
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Cookbook Shelf</h1>
          <p className="text-cb-secondary text-sm mt-1">
            Index your physical cookbooks and search across your entire shelf.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-cb-primary text-white px-5 py-2.5 rounded-input text-sm font-semibold hover:opacity-90 transition-opacity flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Cookbook
        </button>
      </div>

      {/* Ingredient search */}
      <div className="bg-cb-card border border-cb-border rounded-card p-5 mb-8">
        <h2 className="font-semibold mb-1">Search by ingredient</h2>
        <p className="text-cb-secondary text-sm mb-3">
          Find recipes across all your cookbooks by ingredient name.
        </p>
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cb-secondary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="e.g. chicken, basil, mozzarella..."
            className="w-full bg-cb-bg border border-cb-border rounded-input pl-10 pr-4 py-3 text-sm placeholder:text-cb-secondary/60 outline-none focus:border-cb-primary transition-colors"
          />
        </div>

        {/* Search results */}
        {search.trim() && (
          <div className="mt-4">
            {searching ? (
              <p className="text-cb-secondary text-sm py-2">Searching...</p>
            ) : searchResults.length === 0 ? (
              <p className="text-cb-secondary text-sm py-2">
                No cookbook recipes found for &ldquo;{search}&rdquo;
              </p>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-cb-secondary font-medium uppercase tracking-wide">
                  {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
                </p>
                {searchResults.map((recipe) => {
                  const book = cookbooks.find((c) => c.id === recipe.cookbook_id);
                  return (
                    <Link
                      key={recipe.id}
                      href={`/recipe/${recipe.id}`}
                      className="flex items-center justify-between bg-cb-bg rounded-input p-3 hover:bg-cb-border/30 transition-colors"
                    >
                      <div>
                        <p className="font-medium text-sm">{recipe.title}</p>
                        {book && (
                          <p className="text-xs text-cb-secondary">
                            {book.title}
                            {recipe.page_number ? ` — p. ${recipe.page_number}` : ''}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-cb-secondary">
                        {recipe.cuisine && (
                          <span className="bg-cb-primary/10 text-cb-primary px-2 py-0.5 rounded">
                            {recipe.cuisine}
                          </span>
                        )}
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                        </svg>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Cookbook grid */}
      {loading ? (
        <div className="text-center text-cb-secondary py-20">Loading cookbooks...</div>
      ) : cookbooks.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-full bg-cb-primary/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-cb-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0 0 12 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75Z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold mb-2">No cookbooks yet</h2>
          <p className="text-cb-secondary text-sm mb-6">
            Index your physical cookbooks to search across your entire shelf by ingredient.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="bg-cb-primary text-white px-6 py-2.5 rounded-input text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Add Your First Cookbook
          </button>
        </div>
      ) : (
        <div data-onboard="cookbooks-list" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cookbooks.map((book) => (
            <Link
              key={book.id}
              href={`/dashboard/cookbooks/${book.id}`}
              className="bg-cb-card border border-cb-border rounded-card p-5 hover:border-cb-primary/50 transition-colors block"
            >
              <div className="flex gap-4">
                {book.cover_url ? (
                  <img
                    src={proxyIfNeeded(book.cover_url!)}
                    alt={book.title}
                    className="w-16 h-20 rounded object-cover shrink-0"
                  />
                ) : (
                  <div className="w-16 h-20 rounded bg-cb-primary/10 flex items-center justify-center shrink-0">
                    <svg className="w-6 h-6 text-cb-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
                    </svg>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{book.title}</h3>
                  {book.author && (
                    <p className="text-sm text-cb-secondary mt-0.5">by {book.author}</p>
                  )}
                  <div className="flex items-center gap-2 text-xs text-cb-secondary mt-2">
                    {book.year && <span>{book.year}</span>}
                    {book.publisher && (
                      <>
                        <span>&middot;</span>
                        <span>{book.publisher}</span>
                      </>
                    )}
                  </div>
                  {book.rating != null && book.rating > 0 && (
                    <div className="flex gap-0.5 mt-2">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <svg
                          key={i}
                          className={`w-3.5 h-3.5 ${i < book.rating! ? 'text-cb-primary' : 'text-cb-border'}`}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                  )}
                  {book.location && (
                    <p className="text-xs text-cb-secondary mt-1.5">{book.location}</p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Add Cookbook Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-cb-card border border-cb-border rounded-card w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Add Cookbook</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-cb-secondary hover:text-cb-text"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {formError && (
              <div className="bg-red-50 border border-red-200 text-cb-primary rounded-input p-3 mb-4 text-sm">
                {formError}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Title *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Salt, Fat, Acid, Heat"
                  className="w-full bg-cb-bg border border-cb-border rounded-input px-3 py-2.5 text-sm placeholder:text-cb-secondary/60 outline-none focus:border-cb-primary transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Author</label>
                <input
                  type="text"
                  value={form.author}
                  onChange={(e) => setForm({ ...form, author: e.target.value })}
                  placeholder="e.g. Samin Nosrat"
                  className="w-full bg-cb-bg border border-cb-border rounded-input px-3 py-2.5 text-sm placeholder:text-cb-secondary/60 outline-none focus:border-cb-primary transition-colors"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Publisher</label>
                  <input
                    type="text"
                    value={form.publisher}
                    onChange={(e) => setForm({ ...form, publisher: e.target.value })}
                    placeholder="Publisher"
                    className="w-full bg-cb-bg border border-cb-border rounded-input px-3 py-2.5 text-sm placeholder:text-cb-secondary/60 outline-none focus:border-cb-primary transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Year</label>
                  <input
                    type="number"
                    value={form.year}
                    onChange={(e) => setForm({ ...form, year: e.target.value })}
                    placeholder="2018"
                    className="w-full bg-cb-bg border border-cb-border rounded-input px-3 py-2.5 text-sm placeholder:text-cb-secondary/60 outline-none focus:border-cb-primary transition-colors"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">ISBN</label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={form.isbn}
                      onChange={(e) => setForm({ ...form, isbn: e.target.value })}
                      placeholder="978-..."
                      className="flex-1 bg-cb-bg border border-cb-border rounded-input px-3 py-2.5 text-sm placeholder:text-cb-secondary/60 outline-none focus:border-cb-primary transition-colors"
                    />
                    <button
                      onClick={lookupIsbn}
                      disabled={!form.isbn.trim() || isbnLooking}
                      className="bg-cb-primary text-white px-3 py-2 rounded-input text-xs font-semibold hover:opacity-90 disabled:opacity-50 shrink-0"
                    >
                      {isbnLooking ? '...' : 'Lookup'}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Location</label>
                  <input
                    type="text"
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    placeholder="Kitchen shelf"
                    className="w-full bg-cb-bg border border-cb-border rounded-input px-3 py-2.5 text-sm placeholder:text-cb-secondary/60 outline-none focus:border-cb-primary transition-colors"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  placeholder="Any notes about this cookbook..."
                  className="w-full bg-cb-bg border border-cb-border rounded-input px-3 py-2.5 text-sm placeholder:text-cb-secondary/60 outline-none focus:border-cb-primary transition-colors resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-5">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2.5 rounded-input text-sm font-medium text-cb-secondary hover:text-cb-text transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCookbook}
                disabled={saving}
                className="bg-cb-primary text-white px-5 py-2.5 rounded-input text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Add Cookbook'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
