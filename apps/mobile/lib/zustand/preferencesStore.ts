import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '@chefsbook/db';
import type { UnitSystem } from '@chefsbook/ui';

const LANG_KEY = 'chefsbook_language';
const UNITS_KEY = 'chefsbook_units';

interface PreferencesState {
  language: string;
  units: UnitSystem;
  setLanguage: (code: string, userId?: string) => Promise<void>;
  setUnits: (system: UnitSystem, userId?: string) => Promise<void>;
  loadFromLocal: () => Promise<void>;
  loadFromSupabase: (userId: string) => Promise<void>;
}

export const usePreferencesStore = create<PreferencesState>((set) => ({
  language: 'en',
  units: 'imperial',

  setLanguage: async (code, userId) => {
    set({ language: code });
    await SecureStore.setItemAsync(LANG_KEY, code);
    if (userId) {
      await supabase
        .from('user_profiles')
        .update({ preferred_language: code })
        .eq('id', userId);
    }
  },

  setUnits: async (system, userId) => {
    set({ units: system });
    await SecureStore.setItemAsync(UNITS_KEY, system);
    if (userId) {
      await supabase
        .from('user_profiles')
        .update({ preferred_units: system })
        .eq('id', userId);
    }
  },

  loadFromLocal: async () => {
    const lang = await SecureStore.getItemAsync(LANG_KEY);
    const units = await SecureStore.getItemAsync(UNITS_KEY);
    set({
      language: lang || 'en',
      units: (units as UnitSystem) || 'imperial',
    });
  },

  loadFromSupabase: async (userId) => {
    const { data } = await supabase
      .from('user_profiles')
      .select('preferred_language, preferred_units')
      .eq('id', userId)
      .single();
    if (data) {
      const lang = data.preferred_language || 'en';
      const units = (data.preferred_units as UnitSystem) || 'imperial';
      set({ language: lang, units });
      await SecureStore.setItemAsync(LANG_KEY, lang);
      await SecureStore.setItemAsync(UNITS_KEY, units);
    }
  },
}));
