'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@chefsbook/db';
import type { UnitSystem } from '@chefsbook/ui';

const STORAGE_KEY = 'chefsbook_units';

/** Shared unit preference hook — reads from DB on mount, syncs via localStorage events */
export function useUnits() {
  const [units, setUnitsState] = useState<UnitSystem>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem(STORAGE_KEY) as UnitSystem) || 'imperial';
    }
    return 'imperial';
  });

  useEffect(() => {
    // Load from DB
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from('user_profiles').select('preferred_units').eq('id', user.id).single().then(({ data }) => {
        if (data?.preferred_units) {
          const u = data.preferred_units as UnitSystem;
          setUnitsState(u);
          localStorage.setItem(STORAGE_KEY, u);
        }
      });
    });

    // Listen for cross-component changes via storage event
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        setUnitsState(e.newValue as UnitSystem);
      }
    };
    window.addEventListener('storage', handler);

    // Also listen for same-tab changes via custom event
    const customHandler = () => {
      setUnitsState((localStorage.getItem(STORAGE_KEY) as UnitSystem) || 'imperial');
    };
    window.addEventListener('units-changed', customHandler);

    return () => {
      window.removeEventListener('storage', handler);
      window.removeEventListener('units-changed', customHandler);
    };
  }, []);

  const setUnits = useCallback(async (next: UnitSystem) => {
    setUnitsState(next);
    localStorage.setItem(STORAGE_KEY, next);
    window.dispatchEvent(new Event('units-changed'));
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('user_profiles').update({ preferred_units: next }).eq('id', user.id);
    }
  }, []);

  return { units, isMetric: units === 'metric', setUnits };
}
