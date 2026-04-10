import React, { useState, useCallback, ReactNode } from 'react';
import ChefsDialog from './ChefsDialog';
import type { ChefsDialogButton } from './ChefsDialog';

interface ConfirmOptions {
  icon?: string;
  title: string;
  body: string | ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'primary' | 'positive';
}

interface AlertOptions {
  icon?: string;
  title: string;
  body: string;
}

/**
 * Hook providing an imperative confirm() that renders ChefsDialog.
 * Returns [confirm, DialogElement].
 *
 * Usage:
 *   const [confirm, ConfirmDialog] = useConfirmDialog();
 *   const ok = await confirm({ title: 'Delete?', body: 'Cannot undo.' });
 */
export function useConfirmDialog(): [(opts: ConfirmOptions) => Promise<boolean>, React.FC] {
  const [state, setState] = useState<{ opts: ConfirmOptions; resolve: (v: boolean) => void } | null>(null);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => setState({ opts, resolve }));
  }, []);

  const Dialog: React.FC = useCallback(() => {
    if (!state) return null;
    const { opts, resolve } = state;
    const close = (result: boolean) => { resolve(result); setState(null); };
    return (
      <ChefsDialog
        visible
        icon={opts.icon}
        title={opts.title}
        body={opts.body}
        onClose={() => close(false)}
        buttons={[
          { label: opts.cancelLabel ?? 'Cancel', variant: 'cancel', onPress: () => close(false) },
          { label: opts.confirmLabel ?? 'Confirm', variant: opts.variant ?? 'primary', onPress: () => close(true) },
        ]}
      />
    );
  }, [state]);

  return [confirm, Dialog];
}

/**
 * Hook providing an imperative alert() that renders ChefsDialog.
 */
export function useAlertDialog(): [(opts: AlertOptions) => void, React.FC] {
  const [state, setState] = useState<AlertOptions | null>(null);

  const showAlert = useCallback((opts: AlertOptions) => setState(opts), []);

  const Dialog: React.FC = useCallback(() => {
    if (!state) return null;
    return (
      <ChefsDialog
        visible
        icon={state.icon}
        title={state.title}
        body={state.body}
        onClose={() => setState(null)}
        buttons={[{ label: 'OK', variant: 'positive', onPress: () => setState(null) }]}
      />
    );
  }, [state]);

  return [showAlert, Dialog];
}
