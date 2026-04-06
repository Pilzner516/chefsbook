'use client';

import { useState, useEffect } from 'react';
import type { RecipeWithDetails } from '@chefsbook/db';

type Platform = 'instagram' | 'pinterest' | 'facebook';
const PLATFORMS: { key: Platform; icon: string; label: string; charLimit: number }[] = [
  { key: 'instagram', icon: '📷', label: 'Instagram', charLimit: 2200 },
  { key: 'pinterest', icon: '📌', label: 'Pinterest', charLimit: 500 },
  { key: 'facebook', icon: '👍', label: 'Facebook', charLimit: 63206 },
];

export default function SocialShareModal({
  recipe,
  onClose,
}: {
  recipe: RecipeWithDetails;
  onClose: () => void;
}) {
  const [platform, setPlatform] = useState<Platform>('instagram');
  const [postText, setPostText] = useState('');
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [newHashtag, setNewHashtag] = useState('');
  const [generatingText, setGeneratingText] = useState(false);
  const [generatingTags, setGeneratingTags] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/recipe/${recipe.id}`;
  const ingNames = recipe.ingredients.map((i) => i.ingredient);
  const currentLimit = PLATFORMS.find((p) => p.key === platform)?.charLimit ?? 2200;

  // Generate text + hashtags on open and platform change
  useEffect(() => {
    generateText();
    if (hashtags.length === 0) generateTags();
  }, [platform]);

  const generateText = async () => {
    setGeneratingText(true);
    try {
      const res = await fetch('/api/social/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: recipe.title, description: recipe.description, cuisine: recipe.cuisine, ingredients: ingNames, platform, type: 'post' }),
      });
      const data = await res.json();
      if (data.text) setPostText(data.text);
    } catch {} finally { setGeneratingText(false); }
  };

  const generateTags = async () => {
    setGeneratingTags(true);
    try {
      const res = await fetch('/api/social/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: recipe.title, cuisine: recipe.cuisine, course: recipe.course, tags: recipe.tags, ingredients: ingNames, type: 'hashtags' }),
      });
      const data = await res.json();
      if (data.hashtags) setHashtags(data.hashtags);
    } catch {} finally { setGeneratingTags(false); }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    } catch {}
  };

  const downloadImage = async () => {
    if (!recipe.image_url) return;
    try {
      const res = await fetch(recipe.image_url);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${recipe.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.jpg`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {}
  };

  const mobileShare = async () => {
    if (!navigator.share) return;
    const fullText = `${postText}\n\n${hashtags.join(' ')}`;
    try {
      if (recipe.image_url) {
        const res = await fetch(recipe.image_url);
        const blob = await res.blob();
        const file = new File([blob], 'recipe.jpg', { type: blob.type });
        await navigator.share({ text: fullText, files: [file] });
      } else {
        await navigator.share({ text: fullText, url: shareUrl });
      }
    } catch {
      await navigator.share({ text: fullText, url: shareUrl }).catch(() => {});
    }
  };

  const fullText = `${postText}\n\n${hashtags.join(' ')}`;
  const isMobile = typeof navigator !== 'undefined' && 'share' in navigator;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-end">
      <div className="bg-cb-card w-full max-w-lg h-full overflow-y-auto shadow-xl flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-cb-border flex items-center justify-between shrink-0">
          <h2 className="text-lg font-bold">Share to Social</h2>
          <button onClick={onClose} className="text-cb-secondary hover:text-cb-text">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Image preview */}
          {recipe.image_url && (
            <div className="rounded-card overflow-hidden">
              <img src={recipe.image_url} alt={recipe.title} className="w-full h-48 object-cover" />
            </div>
          )}

          {/* Platform tabs */}
          <div className="flex border border-cb-border rounded-input overflow-hidden">
            {PLATFORMS.map((p) => (
              <button key={p.key} onClick={() => setPlatform(p.key)} className={`flex-1 py-2.5 text-sm font-medium transition-colors ${platform === p.key ? 'bg-cb-primary text-white' : 'text-cb-secondary hover:text-cb-text'}`}>
                {p.icon} {p.label}
              </button>
            ))}
          </div>

          {/* Post text */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-semibold">Post Text</label>
              <button onClick={generateText} disabled={generatingText} className="text-xs text-cb-primary hover:underline disabled:opacity-50">{generatingText ? 'Generating...' : 'Regenerate'}</button>
            </div>
            <textarea
              value={postText}
              onChange={(e) => setPostText(e.target.value)}
              rows={5}
              className="w-full bg-cb-bg border border-cb-border rounded-input px-3 py-2 text-sm outline-none focus:border-cb-primary"
            />
            <p className={`text-[10px] mt-0.5 ${postText.length > currentLimit * 0.9 ? 'text-amber-600' : 'text-cb-secondary'}`}>
              {postText.length}/{currentLimit}
            </p>
          </div>

          {/* Hashtags */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-semibold">Hashtags</label>
              <div className="flex gap-2">
                <button onClick={() => copyToClipboard(hashtags.join(' '), 'tags')} className="text-xs text-cb-secondary hover:text-cb-text">{copied === 'tags' ? 'Copied!' : 'Copy all'}</button>
                <button onClick={generateTags} disabled={generatingTags} className="text-xs text-cb-primary hover:underline disabled:opacity-50">{generatingTags ? '...' : 'Regenerate'}</button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {hashtags.map((tag, i) => (
                <span key={i} className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                  {tag}
                  <button onClick={() => setHashtags((prev) => prev.filter((_, j) => j !== i))} className="hover:text-red-600">
                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-1.5">
              <input value={newHashtag} onChange={(e) => setNewHashtag(e.target.value.replace(/\s/g, ''))} onKeyDown={(e) => { if (e.key === 'Enter' && newHashtag) { setHashtags((prev) => [...prev, newHashtag.startsWith('#') ? newHashtag : `#${newHashtag}`]); setNewHashtag(''); } }} placeholder="#newtag" className="flex-1 bg-cb-bg border border-cb-border rounded-input px-2 py-1 text-xs outline-none focus:border-cb-primary" />
              <button onClick={() => { if (newHashtag) { setHashtags((prev) => [...prev, newHashtag.startsWith('#') ? newHashtag : `#${newHashtag}`]); setNewHashtag(''); } }} className="text-xs text-cb-primary hover:underline">Add</button>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2">
            {isMobile ? (
              <button onClick={mobileShare} className="w-full bg-cb-primary text-white py-3 rounded-input text-sm font-semibold hover:opacity-90 flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" /></svg>
                Share via...
              </button>
            ) : (
              <>
                <button onClick={() => copyToClipboard(fullText, 'post')} className="w-full bg-cb-card border border-cb-border py-2.5 rounded-input text-sm font-medium hover:bg-cb-bg flex items-center justify-center gap-2">
                  {copied === 'post' ? '✓ Copied!' : '📋 Copy Post Text + Hashtags'}
                </button>
                {recipe.image_url && (
                  <button onClick={downloadImage} className="w-full bg-cb-card border border-cb-border py-2.5 rounded-input text-sm font-medium hover:bg-cb-bg flex items-center justify-center gap-2">
                    🖼️ Download Image
                  </button>
                )}
                {platform === 'instagram' && (
                  <a href="https://www.instagram.com/" target="_blank" rel="noopener noreferrer" className="w-full bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 text-white py-2.5 rounded-input text-sm font-semibold text-center block hover:opacity-90">
                    📱 Open Instagram
                  </a>
                )}
                {platform === 'pinterest' && (
                  <a href={`https://pinterest.com/pin/create/button/?url=${encodeURIComponent(shareUrl)}&media=${encodeURIComponent(recipe.image_url ?? '')}&description=${encodeURIComponent(fullText)}`} target="_blank" rel="noopener noreferrer" className="w-full bg-red-600 text-white py-2.5 rounded-input text-sm font-semibold text-center block hover:opacity-90">
                    📌 Create Pin on Pinterest
                  </a>
                )}
                {platform === 'facebook' && (
                  <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noopener noreferrer" className="w-full bg-blue-600 text-white py-2.5 rounded-input text-sm font-semibold text-center block hover:opacity-90">
                    👍 Share on Facebook
                  </a>
                )}
              </>
            )}
          </div>

          {/* Instructions */}
          {!isMobile && (
            <div className="bg-cb-bg rounded-input p-3 text-xs text-cb-secondary">
              <p className="font-semibold mb-1">How to post:</p>
              <ol className="list-decimal list-inside space-y-0.5">
                <li>Copy your post text above</li>
                <li>Download your recipe image</li>
                <li>Open the platform</li>
                <li>Create a new post, paste text and upload image</li>
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
