'use client';

import { useState } from 'react';
import { supabase } from '@chefsbook/db';
import ChefsDialog from './ChefsDialog';

interface Props {
  userId: string | null;
  username: string | null;
  email: string | null;
}

export default function FeedbackCard({ userId, username, email }: Props) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [showThank, setShowThank] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!userId || message.trim().length < 10) return;
    setSending(true);
    setSubmitError(null);
    try {
      const { error } = await supabase.from('help_requests').insert({
        user_id: userId,
        user_email: email,
        username,
        message: message.trim(),
        subject: 'Feedback',
        body: message.trim(),
        status: 'open',
      });
      if (error) throw error;
      setOpen(false);
      setMessage('');
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
        <img src="/images/chefs-hat.png" alt="" className="w-16 h-16 object-contain mb-3 opacity-70" />
        <h3 className="text-base font-bold text-cb-text">Got an Idea for Us?</h3>
        <p className="text-[13px] text-cb-secondary mt-1">We&apos;d love to hear from you</p>
      </button>

      {/* Feedback form modal */}
      {open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setOpen(false)}>
          <div className="bg-cb-card rounded-card p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-cb-text">Got an Idea for Us?</h2>
              <button onClick={() => setOpen(false)} className="text-cb-muted hover:text-cb-text">✕</button>
            </div>

            <div className="flex justify-center mb-4">
              <img src="/images/chefs-hat.png" alt="" className="w-16 h-16 object-contain opacity-70" />
            </div>

            <p className="text-sm text-cb-secondary text-center mb-4">
              We&apos;d love to hear your thoughts, ideas, or suggestions for ChefsBook.
            </p>

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
              <p className={`text-xs mt-1 mb-1 ${message.length === 0 ? 'text-cb-muted' : 'text-cb-primary'}`}>
                {message.length === 0 ? 'Minimum 10 characters' : `${message.trim().length}/10 characters minimum`}
              </p>
            )}
            {message.trim().length >= 10 && (
              <p className="text-xs mt-1 mb-1 text-cb-green">✓ Ready to send</p>
            )}

            <button
              onClick={handleSubmit}
              disabled={message.trim().length < 10 || sending}
              className="w-full bg-cb-primary text-white py-2.5 rounded-input text-sm font-semibold hover:opacity-90 disabled:opacity-50 mt-2"
            >
              {sending ? 'Sending...' : 'Send Feedback'}
            </button>
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
