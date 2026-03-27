'use client';

import { useEffect, useState } from 'react';
import { supabase, listCookbooks } from '@chefsbook/db';
import type { Cookbook } from '@chefsbook/db';

export default function CookbooksPage() {
  const [cookbooks, setCookbooks] = useState<Cookbook[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCookbooks();
  }, []);

  const loadCookbooks = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const data = await listCookbooks(user.id);
      setCookbooks(data);
    }
    setLoading(false);
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-8">My Cookbooks</h1>
      {loading ? (
        <div className="text-center text-cb-text-secondary py-20">Loading...</div>
      ) : cookbooks.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-4xl mb-4">{'\uD83D\uDCDA'}</div>
          <h2 className="text-lg font-semibold mb-2">No cookbooks yet</h2>
          <p className="text-cb-text-secondary text-sm">Index your physical cookbooks to search across your entire shelf.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cookbooks.map((book) => (
            <div key={book.id} className="bg-cb-surface border border-cb-border rounded-xl p-5 hover:border-cb-primary/50 transition-colors">
              <h3 className="font-semibold mb-1">{book.title}</h3>
              {book.author && <p className="text-sm text-cb-text-secondary mb-2">by {book.author}</p>}
              <div className="flex items-center gap-2 text-xs text-cb-text-tertiary">
                {book.year && <span>{book.year}</span>}
                {book.publisher && <span>{'\u00B7'} {book.publisher}</span>}
                {book.rating && <span>{'\u00B7'} {'\u2B50'.repeat(book.rating)}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
