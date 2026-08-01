import { create } from 'zustand';
import { supabase } from '../lib/supabase';

interface NotificationStore {
  unreadCount: number;
  fetchUnreadCount: (userId: string) => Promise<void>;
  decrementUnread: () => void;
  resetUnread: () => void;
  subscribeToNotifications: (userId: string) => void;
  unsubscribeFromNotifications: () => void;
  subscription: any;
}

export const useNotificationStore = create<NotificationStore>((set) => ({
  unreadCount: 0,
  
  fetchUnreadCount: async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('id, user_id')
        .or(`user_id.eq.${userId},user_id.is.null`)
        .eq('is_read', false);

      if (!error && data) {
        const cacheKeyDel = `deleted_global_notifs_${userId}`;
        const cacheKeyRead = `read_global_notifs_${userId}`;
        const deletedGlobal = JSON.parse(localStorage.getItem(cacheKeyDel) || '[]');
        const readGlobal = JSON.parse(localStorage.getItem(cacheKeyRead) || '[]');
        
        const filteredData = data.filter((n: any) => 
          !(n.user_id === null && (deletedGlobal.includes(n.id) || readGlobal.includes(n.id)))
        );
        set({ unreadCount: filteredData.length });
      }
    } catch (err) {
      console.error('Error fetching unread count:', err);
    }
  },
  
  subscribeToNotifications: (userId: string) => {
    const currentState = useNotificationStore.getState();
    if (currentState.subscription) return;

    const sub = supabase
      .channel('public:notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}` // We can only filter by eq in postgres_changes easily, for global we might need to listen to all or check on client
        },
        (payload) => {
          set((state) => ({ unreadCount: state.unreadCount + 1 }));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=is.null`
        },
        (payload) => {
          set((state) => ({ unreadCount: state.unreadCount + 1 }));
        }
      )
      .subscribe();

    set({ subscription: sub });
  },

  unsubscribeFromNotifications: () => {
    const { subscription } = useNotificationStore.getState();
    if (subscription) {
      supabase.removeChannel(subscription);
      set({ subscription: null });
    }
  },
  
  decrementUnread: () => set((state) => ({ unreadCount: Math.max(0, state.unreadCount - 1) })),
  
  resetUnread: () => set({ unreadCount: 0 }),
}));
