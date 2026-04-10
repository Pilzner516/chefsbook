'use client';

import { useState, useCallback, ReactNode } from 'react';
import ChefsDialog from './ChefsDialog';

interface ConfirmOptions {
  icon?: string;
  title: string;
  body: string | ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'primary' | 'positive';
}

/**
 * Hook that provides an imperative confirm() replacement using ChefsDialog.
 * Returns [confirm, DialogElement].
 *
 * Usage:
 *   const [confirm, ConfirmDialog] = useConfirmDialog();
 *   const ok = await confirm({ title: 'Delete?', body: 'This cannot be undone.' });
 *   if (ok) { ... }
 *   // Render <ConfirmDialog /> somewhere in JSX
 */
export function useConfirmDialog(): [(opts: ConfirmOptions) => Promise<boolean>, () => ReactNode] {
  const [state, setState] = useState<{ opts: ConfirmOptions; resolve: (v: boolean) => void } | null>(null);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({ opts, resolve });
    });
  }, []);

  const DialogElement = useCallback(() => {
    if (!state) return null;
    const { opts, resolve } = state;
    const close = (result: boolean) => { resolve(result); setState(null); };
    return (
      <ChefsDialog
        open={true}
        icon={opts.icon}
        title={opts.title}
        body={opts.body}
        onClose={() => close(false)}
        buttons={[
          { label: opts.cancelLabel ?? 'Cancel', variant: 'cancel', onClick: () => close(false) },
          { label: opts.confirmLabel ?? 'Confirm', variant: opts.variant ?? 'primary', onClick: () => close(true) },
        ]}
      />
    );
  }, [state]);

  return [confirm, DialogElement];
}

/**
 * Simple alert dialog (no confirmation needed, just OK).
 */
export function useAlertDialog(): [(opts: { icon?: string; title: string; body: string }) => void, () => ReactNode] {
  const [state, setState] = useState<{ icon?: string; title: string; body: string } | null>(null);

  const showAlert = useCallback((opts: { icon?: string; title: string; body: string }) => {
    setState(opts);
  }, []);

  const DialogElement = useCallback(() => {
    if (!state) return null;
    return (
      <ChefsDialog
        open={true}
        icon={state.icon}
        title={state.title}
        body={state.body}
        onClose={() => setState(null)}
        buttons={[
          { label: 'OK', variant: 'positive', onClick: () => setState(null) },
        ]}
      />
    );
  }, [state]);

  return [showAlert, DialogElement];
}
