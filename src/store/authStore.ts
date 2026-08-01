import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Session, User } from '@supabase/supabase-js';

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: 'user' | 'admin';
  status: 'pending' | 'approved' | 'suspended';
  avatar_url?: string;
  xp?: number;
}

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  initialize: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  profile: null,
  loading: true,

  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        // Fetch profile
        const { data: profile } = await supabase
          .from('users_profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        set({ session, user: session.user, profile, loading: false });
      } else {
        set({ session: null, user: null, profile: null, loading: false });
      }

      // Listen for auth changes
      supabase.auth.onAuthStateChange(async (_event, session) => {
        if (session?.user) {
          const { data: profile } = await supabase
            .from('users_profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
          set({ session, user: session.user, profile, loading: false });
        } else {
          set({ session: null, user: null, profile: null, loading: false });
        }
      });
    } catch (error) {
      console.error('Error initializing auth:', error);
      set({ loading: false });
    }
  },

  signOut: async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Supabase auth signOut failed, clearing local session:', err);
    } finally {
      set({ session: null, user: null, profile: null });
    }
  }
}));
