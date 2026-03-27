import { supabase } from '@chefsbook/db';
import type { UserProfile, PlanTier } from '@chefsbook/db';
import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';

interface AuthState {
  session: Session | null;
  profile: UserProfile | null;
  planTier: PlanTier;
  loading: boolean;
  init: () => Promise<void>;
  loadProfile: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  profile: null,
  planTier: 'free',
  loading: true,

  init: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      await supabase.auth.signInAnonymously();
    } else {
      set({ session: data.session });
      await get().loadProfile();
    }

    supabase.auth.onAuthStateChange(async (_event, session) => {
      set({ session });
      if (session) await get().loadProfile();
      else set({ profile: null, planTier: 'free' });
    });

    set({ loading: false });
  },

  loadProfile: async () => {
    const { data } = await supabase
      .from('user_profiles')
      .select('*')
      .single();
    if (data) {
      set({ profile: data as UserProfile, planTier: (data as UserProfile).plan_tier });
    }
  },

  signIn: async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  },

  signUp: async (email: string, password: string, displayName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: displayName } },
    });
    if (error) throw error;
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, profile: null, planTier: 'free' });
  },
}));
