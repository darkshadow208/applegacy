import { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { Bell, CheckCircle } from 'lucide-react';

const mockNotifications = [
  {
    id: 'm1',
    title: '¡Te damos la bienvenida a Legacy Academy! 🚀',
    message: 'Explora nuestros cursos premium de marketing digital, desarrollo personal, criptomonedas y negocios.',
    created_at: new Date().toISOString(),
    is_read: false
  },
  {
    id: 'm2',
    title: 'Plan de Estudio Activado 📚',
    message: 'Organiza tus cursos de interés, ponte metas diarias y programa recordatorios para ser disciplinado.',
    created_at: new Date(Date.now() - 86400000).toISOString(),
    is_read: true
  }
];

export function Notifications() {
  const { user } = useAuthStore();
  
  // Sincronización instantánea en segundo plano (0ms de espera)
  const [notifications, setNotifications] = useState<any[]>(mockNotifications);
  const [loading] = useState(false);

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

        if (!error && data && data.length > 0) {
          // Fusionar las reales de la BD con las de bienvenida
          const merged = [...data];
          mockNotifications.forEach(m => {
            if (!merged.find(x => String(x.id) === String(m.id))) {
              merged.push(m);
            }
          });
          setNotifications(merged);
        }
      } catch (err) {
        // En caso de lentitud, el usuario sigue viendo sus notificaciones locales al instante
        console.warn('Sincronización de notificaciones en segundo plano pausada o en timeout.');
      }
    }
    fetchNotifications();
  }, [user]);

  const markAsRead = async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    if (!id.startsWith('m')) {
      try {
        await supabase.from('notifications').update({ is_read: true }).eq('id', id);
      } catch (err) {
        console.warn('Error al actualizar lectura en base de datos:', err);
      }
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in pb-20">
      
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Notificaciones</h2>
        <p className="text-gray-500 text-sm">Tus alertas y recordatorios.</p>
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
