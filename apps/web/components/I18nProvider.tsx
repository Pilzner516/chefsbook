'use client';

import { useEffect, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n, { activateLanguage } from '@/lib/i18n';
import { supabase } from '@chefsbook/db';

export default function I18nProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
          const { data } = await supabase
            .from('user_profiles')
            .select('preferred_language')
            .eq('id', session.user.id)
            .single();
          if (data?.preferred_language && data.preferred_language !== 'en') {
            await activateLanguage(data.preferred_language);
          }
        }
      } catch {} // Non-blocking — English fallback if query fails
    })();
  }, []);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
