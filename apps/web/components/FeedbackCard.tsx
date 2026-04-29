'use client';

import { useState } from 'react';
import { supabase } from '@chefsbook/db';
import ChefsDialog from './ChefsDialog';

interface Props {
  userId: string | null;
  username: string | null;
  email: string | null;
}

const TAG_OPTIONS = ['Bug', 'Feature Request', 'Question', 'Other'] as const;
type TagType = typeof TAG_OPTIONS[number];

export default function FeedbackCard({ userId, username, email }: Props) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [tag, setTag] = useState<TagType>('Other');
  const [sending, setSending] = useState(false);
  const [showThank, setShowThank] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!userId || message.trim().length < 10) return;
    setSending(true);
    setSubmitError(null);
    try {
      const typeMap: Record<TagType, string> = {
        'Bug': 'bug',
        'Feature Request': 'feature_request',
        'Question': 'question',
        'Other': 'other',
      };
      const { error } = await supabase.from('user_feedback').insert({
        user_id: userId,
        user_email: email,
        username,
        type: typeMap[tag],
        tag,
        source: 'got_an_idea',
        description: message.trim(),
        status: 'new',
      });
      if (error) throw error;
      setOpen(false);
      setMessage('');
      setTag('Other');
      setShowThank(true);
    } catch (e: any) {
      setSubmitError(e.message ?? 'Failed to send feedback. Please try again.');
    }
    setSending(false);
  };

  return (
    <>
      {/* Card in recipe grid */}
      <button
        onClick={() => setOpen(true)}
        className="bg-[#faf7f0] border border-cb-primary rounded-card p-5 text-center hover:shadow-md transition-shadow flex flex-col items-center justify-center h-full min-h-[200px]"
      >
        <img src="/images/chefs-hat-2.png" alt="" className="w-16 h-16 object-contain mb-3" />
        <h3 className="text-base font-bold text-cb-text">Got an Idea for Us?</h3>
        <p className="text-[13px] text-cb-secondary mt-1">We&apos;d love to hear from you</p>
        <span className="mt-3 inline-block bg-cb-primary text-white text-xs font-semibold px-4 py-1.5 rounded-full">Message us</span>
      </button>

      {/* Feedback form modal - iOS keyboard safe */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center"
          style={{ height: '100dvh' }}
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-cb-card rounded-t-card sm:rounded-card w-full sm:max-w-md shadow-xl max-h-[90dvh] overflow-y-auto"
            style={{ WebkitOverflowScrolling: 'touch' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sticky header with close and submit */}
            <div className="sticky top-0 bg-cb-card z-10 px-6 pt-6 pb-4 border-b border-cb-border">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-bold text-cb-text">Got an Idea for Us?</h2>
                <button onClick={() => setOpen(false)} className="text-cb-muted hover:text-cb-text text-xl leading-none p-1">✕</button>
              </div>
              {/* Submit button at TOP for iOS keyboard safety */}
              <button
                onClick={handleSubmit}
                disabled={message.trim().length < 10 || sending}
                className="w-full bg-cb-primary text-white py-2.5 rounded-input text-sm font-semibold hover:opacity-90 disabled:opacity-50"
              >
                {sending ? 'Sending...' : 'Send Feedback'}
              </button>
            </div>

            <div className="px-6 pb-6 pt-4">
              <div className="flex justify-center mb-4">
                <img src="/images/chefs-hat-2.png" alt="" className="w-14 h-14 object-contain" />
              </div>

              <p className="text-sm text-cb-secondary text-center mb-4">
                We&apos;d love to hear your thoughts, ideas, or suggestions for ChefsBook.
              </p>

              {/* Tag pills */}
              <div className="flex flex-wrap gap-2 justify-center mb-4">
                {TAG_OPTIONS.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTag(t)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                      tag === t
                        ? 'bg-cb-primary text-white'
                        : 'bg-cb-bg border border-cb-border text-cb-text hover:border-cb-primary'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {username && (
                <p className="text-xs text-cb-muted mb-3">
                  From: <span className="font-medium text-cb-text">@{username}</span>
                  {email && <span className="text-cb-muted"> ({email})</span>}
                </p>
              )}

              {submitError && (
                <div className="bg-red-50 border border-red-200 text-cb-primary rounded-input p-2.5 mb-3 text-xs">
                  {submitError}
                </div>
              )}

              <div className="relative mb-1">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value.slice(0, 500))}
                  placeholder="Your message (min 10 characters)"
                  maxLength={500}
                  rows={4}
                  className="w-full bg-cb-bg border border-cb-border rounded-input px-3 py-2.5 text-sm outline-none focus:border-cb-primary resize-none"
                />
                <span className="absolute bottom-2 right-3 text-[11px] text-cb-muted">{message.length}/500</span>
              </div>

              {/* Character minimum helper */}
              {message.trim().length < 10 && (
                <p className={`text-xs mt-1 ${message.length === 0 ? 'text-cb-muted' : 'text-cb-primary'}`}>
                  {message.length === 0 ? 'Minimum 10 characters' : `${message.trim().length}/10 characters minimum`}
                </p>
              )}
              {message.trim().length >= 10 && (
                <p className="text-xs mt-1 text-cb-green">✓ Ready to send</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Thank you dialog */}
      <ChefsDialog
        open={showThank}
        icon="🙏"
        title="Thanks for your feedback!"
        body="We hope you are enjoying ChefsBook. Your ideas help us make it better for everyone."
        onClose={() => setShowThank(false)}
        buttons={[{ label: 'OK', variant: 'positive', onClick: () => setShowThank(false) }]}
      />
    </>
  );
}
