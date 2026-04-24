'use client';

import { useState, useEffect } from 'react';
import { supabase, sendMessage } from '@chefsbook/db';
import { moderateMessage } from '@chefsbook/ai';
import ChefsDialog from './ChefsDialog';
import { useAlertDialog } from './useConfirmDialog';

export default function MessageButton({ targetUserId, targetUsername }: { targetUserId: string; targetUsername: string | null }) {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [showAlert, AlertDialog] = useAlertDialog();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user && user.id !== targetUserId) setCurrentUserId(user.id);
    });
  }, [targetUserId]);

  if (!currentUserId) return null;

  const handleSend = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      let modStatus = 'clean';
      try { const mod = await moderateMessage(text.trim()); modStatus = mod.verdict; } catch {}
      await sendMessage(currentUserId, targetUserId, text.trim(), modStatus);
      setSent(true);
      setText('');
      setTimeout(() => { setSent(false); setShowCompose(false); }, 2000);
    } catch (e: any) {
      showAlert({ title: 'Error', body: e.message ?? 'Failed to send' });
    }
    setSending(false);
  };

  return (
    <>
      <button
        onClick={() => setShowCompose(true)}
        className="mt-3 ml-2 px-4 py-2 rounded-full text-sm font-medium bg-cb-card border border-cb-border text-cb-secondary hover:text-cb-text hover:bg-cb-bg transition-colors"
      >
        Message
      </button>
      <ChefsDialog
        open={showCompose}
        title={sent ? 'Message sent!' : `Message @${targetUsername ?? '?'}`}
        body={
          sent ? (
            <p className="text-cb-green text-sm">Your message has been delivered.</p>
          ) : (
            <div className="w-full">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, 1000))}
                placeholder="Write a message..."
                rows={4}
                className="w-full bg-cb-bg border border-cb-border rounded-input px-3 py-2 text-sm outline-none focus:border-cb-primary resize-none"
              />
              <p className="text-[10px] text-cb-muted text-right">{text.length}/1000</p>
            </div>
          )
        }
        onClose={() => { setShowCompose(false); setText(''); }}
        buttons={sent ? [
          { label: 'OK', variant: 'positive', onClick: () => { setShowCompose(false); setSent(false); } },
        ] : [
          { label: 'Cancel', variant: 'cancel', onClick: () => { setShowCompose(false); setText(''); } },
          { label: sending ? 'Sending...' : 'Send', variant: 'positive', onClick: handleSend },
        ]}
      />
      <AlertDialog />
    </>
  );
}
