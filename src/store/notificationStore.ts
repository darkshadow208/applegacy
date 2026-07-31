import { create } from 'zustand';
import { supabase } from '../lib/supabase';

interface NotificationStore {
  unreadCount: number;
  fetchUnreadCount: (userId: string) => Promise<void>;
  decrementUnread: () => void;
  resetUnread: () => void;
}

export const useNotificationStore = create<NotificationStore>((set) => ({
  unreadCount: 0,
  
  fetchUnreadCount: async (userId: string) => {
    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .or(`user_id.eq.${userId},user_id.is.null`)
        .eq('is_read', false);

      if (!error && count !== null) {
        set({ unreadCount: count });
      }
    } catch (err) {
      console.error('Error fetching unread count:', err);
    }
  },
  
  decrementUnread: () => set((state) => ({ unreadCount: Math.max(0, state.unreadCount - 1) })),
  
  resetUnread: () => set({ unreadCount: 0 }),
}));
