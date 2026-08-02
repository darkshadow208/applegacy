import { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useNotificationStore } from '../../store/notificationStore';
import { supabase } from '../../lib/supabase';
import { Bell, CheckCircle, Trash2, CheckCheck } from 'lucide-react';

export function Notifications() {
  const { user } = useAuthStore();
  const { decrementUnread, resetUnread } = useNotificationStore();
  
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchNotifications() {
      if (!user) return;
      try {
        const fetchPromise = supabase
          .from('notifications')
          .select('*')
          .or(`user_id.eq.${user.id},user_id.is.null`)
          .order('created_at', { ascending: false });

        // Limitar la espera a 2.5s para no bloquear al usuario en redes inestables
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2500));
        const { data, error } = await Promise.race([fetchPromise, timeoutPromise]) as any;

        if (!error && data) {
          // Consultar los estados sincronizados desde la DB
          const { data: profile } = await supabase
            .from('users_profiles')
            .select('deleted_global_notifs, read_global_notifs')
            .eq('id', user.id)
            .maybeSingle();

          const cacheKeyDel = `deleted_global_notifs_${user.id}`;
          const cacheKeyRead = `read_global_notifs_${user.id}`;
          
          const deletedGlobal = profile?.deleted_global_notifs || JSON.parse(localStorage.getItem(cacheKeyDel) || '[]');
          const readGlobal = profile?.read_global_notifs || JSON.parse(localStorage.getItem(cacheKeyRead) || '[]');
          
          // Filter out global notifications that the user has cleared locally or in DB
          const filteredData = data.filter((n: any) => !(n.user_id === null && deletedGlobal.includes(n.id)));
          
          // Mark global notifications as read locally or in DB
          const mappedData = filteredData.map((n: any) => 
            (n.user_id === null && readGlobal.includes(n.id)) ? { ...n, is_read: true } : n
          );
          
          setNotifications(mappedData);
        }
      } catch (err) {
        console.warn('Sincronización de notificaciones pausada o en timeout.', err);
      } finally {
        setLoading(false);
      }
    }
    fetchNotifications();
  }, [user]);

  const markAsRead = async (id: string) => {
    const notif = notifications.find(n => n.id === id);
    if (notif && notif.user_id === null && user) {
      // 1. Guardar localmente
      const cacheKeyRead = `read_global_notifs_${user.id}`;
      const readGlobalLocal = JSON.parse(localStorage.getItem(cacheKeyRead) || '[]');
      if (!readGlobalLocal.includes(id)) {
        localStorage.setItem(cacheKeyRead, JSON.stringify([...readGlobalLocal, id]));
      }

      // 2. Sincronizar en DB
      try {
        const { data: profile } = await supabase
          .from('users_profiles')
          .select('read_global_notifs')
          .eq('id', user.id)
          .maybeSingle();
        
        const currentRead = profile?.read_global_notifs || [];
        if (!currentRead.includes(id)) {
          await supabase.from('users_profiles').update({
            read_global_notifs: [...currentRead, id]
          }).eq('id', user.id);
        }
      } catch (err) {
        console.warn('Error al sincronizar lectura en DB:', err);
      }
    }

    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    decrementUnread();
    
    if (notif && notif.user_id !== null) {
      const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
      if (error) {
        console.warn('Error al actualizar lectura en base de datos:', error);
      }
    }
  };

  const markAllAsRead = async () => {
    const unreadGlobals = notifications.filter(n => n.user_id === null && !n.is_read).map(n => n.id);
    if (unreadGlobals.length > 0 && user) {
      // Local
      const cacheKeyRead = `read_global_notifs_${user.id}`;
      const readGlobalLocal = JSON.parse(localStorage.getItem(cacheKeyRead) || '[]');
      const newReadsLocal = Array.from(new Set([...readGlobalLocal, ...unreadGlobals]));
      localStorage.setItem(cacheKeyRead, JSON.stringify(newReadsLocal));

      // DB
      try {
        const { data: profile } = await supabase
          .from('users_profiles')
          .select('read_global_notifs')
          .eq('id', user.id)
          .maybeSingle();
        
        const currentRead = profile?.read_global_notifs || [];
        const newReads = Array.from(new Set([...currentRead, ...unreadGlobals]));
        await supabase.from('users_profiles').update({ read_global_notifs: newReads }).eq('id', user.id);
      } catch (err) {
        console.warn('Error al marcar todas como leídas en DB:', err);
      }
    }

    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    resetUnread();
    if (user) {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
      if (error) {
        console.error('Error marking all as read:', error);
      }
    }
  };

  const clearAll = async () => {
    // Identificar notificaciones globales para borrarlas localmente
    const globalIds = notifications.filter(n => n.user_id === null).map(n => n.id);
    if (globalIds.length > 0 && user) {
      // Local
      const cacheKey = `deleted_global_notifs_${user.id}`;
      const deletedGlobalLocal = JSON.parse(localStorage.getItem(cacheKey) || '[]');
      localStorage.setItem(cacheKey, JSON.stringify([...deletedGlobalLocal, ...globalIds]));

      // DB
      try {
        const { data: profile } = await supabase
          .from('users_profiles')
          .select('deleted_global_notifs')
          .eq('id', user.id)
          .maybeSingle();
        
        const currentDeleted = profile?.deleted_global_notifs || [];
        const newDeleted = Array.from(new Set([...currentDeleted, ...globalIds]));
        await supabase.from('users_profiles').update({ deleted_global_notifs: newDeleted }).eq('id', user.id);
      } catch (err) {
        console.warn('Error al borrar notificaciones globales en DB:', err);
      }
    }

    setNotifications([]);
    resetUnread();
    const personalIdsToDelete = notifications.filter(n => n.user_id !== null).map(n => n.id);
    if (personalIdsToDelete.length > 0) {
      const { error } = await supabase.from('notifications').delete().in('id', personalIdsToDelete);
      if (error) {
        console.error('Error clearing notifications:', error);
      }
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in pb-20">
      
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Notificaciones</h2>
          <p className="text-gray-500 text-sm">Tus alertas y recordatorios.</p>
        </div>
        {notifications.length > 0 && (
          <div className="flex gap-2">
            <button 
              onClick={markAllAsRead}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-full text-xs font-semibold hover:bg-blue-100 transition-colors"
            >
              <CheckCheck size={14} /> Leídas
            </button>
            <button 
              onClick={clearAll}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-full text-xs font-semibold hover:bg-red-100 transition-colors"
            >
              <Trash2 size={14} /> Limpiar
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {loading ? (
          <p className="text-gray-500 text-center py-10">Cargando...</p>
        ) : notifications.length > 0 ? (
          notifications.map(notif => (
            <div 
              key={notif.id} 
              onClick={() => !notif.is_read && markAsRead(notif.id)}
              className={`bg-white/80 backdrop-blur-md rounded-3xl p-5 shadow-sm border transition-all ${
                notif.is_read ? 'border-transparent opacity-70' : 'border-blue-100 bg-blue-50/50 cursor-pointer'
              }`}
            >
              <div className="flex gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  notif.is_read ? 'bg-gray-100 text-gray-400' : 'bg-blue-100 text-blue-600'
                }`}>
                  <Bell size={20} />
                </div>
                <div>
                  <h4 className={`text-sm ${notif.is_read ? 'font-medium text-gray-700' : 'font-bold text-gray-900'}`}>
                    {notif.title}
                  </h4>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">{notif.message}</p>
                  <span className="text-[10px] text-gray-400 mt-2 block">
                    {new Date(notif.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-10 bg-white/60 backdrop-blur-md rounded-3xl border border-white/80">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle size={24} className="text-gray-400" />
            </div>
            <p className="text-gray-500 font-medium">Todo al día</p>
            <p className="text-xs text-gray-400 mt-1">No tienes notificaciones nuevas.</p>
          </div>
        )}
      </div>

    </div>
  );
}
