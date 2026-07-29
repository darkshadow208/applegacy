import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { User, LogOut, Lock, Bell, ChevronRight, Loader2, Camera, CreditCard, HelpCircle, Heart, Target, Settings } from 'lucide-react';

const mockCourses = [
  { id: '3', title: 'De Cero a Criptoinversor', description: 'Entiende blockchain y criptomonedas.', category: 'Inversiones', image: 'https://images.unsplash.com/photo-1621416894569-0f39ed31d247?q=80&w=800', drive_url: '#' },
  { id: '2', title: 'Hábitos de Alta Productividad', description: 'Cómo organizar tu día para lograr más.', category: 'Desarrollo Personal', image: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?q=80&w=800', drive_url: '#' },
  { id: '1', title: 'Masterclass en Estrategia Digital', description: 'Aprende a crear embudos de venta.', category: 'Marketing Digital', image: 'https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=800', drive_url: '#' },
  { id: '4', title: 'Gestión de Equipos Remotos', description: 'Lidera equipos a distancia con éxito.', category: 'Negocios', image: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=800', drive_url: '#' },
  { id: '5', title: 'Psicología de Ventas', description: 'Vende más sin parecer que estás vendiendo.', category: 'Marketing Digital', image: 'https://images.unsplash.com/photo-1556761175-4b46a572b786?q=80&w=800', drive_url: '#' },
  { id: '6', title: 'Bolsa de Valores para Novatos', description: 'Tu primera inversión en acciones.', category: 'Inversiones', image: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?q=80&w=800', drive_url: '#' },
];

export function Profile() {
  const { profile, user, signOut } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // States para edición
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [password, setPassword] = useState('');
  const [favorites, setFavorites] = useState<any[]>([]);

  useEffect(() => {
    async function fetchFavorites() {
      if (!user) return;
      try {
        // 1. Cargar favoritos locales de localStorage AL INSTANTE (0ms)
        const localKey = `local_favorites_${user.id}`;
        const localSaved = localStorage.getItem(localKey) || '[]';
        const localFavIds = JSON.parse(localSaved);
        
        const localFavCourses = mockCourses
          .filter(c => localFavIds.includes(c.id))
          .map(c => ({
            course_id: c.id,
            courses: {
              id: c.id,
              title: c.title,
              image_url: c.image,
              description: c.description,
              drive_url: c.drive_url
            }
          }));

        setFavorites(localFavCourses);

        // 2. Sincronizar con base de datos en segundo plano
        try {
          const fetchPromise = supabase
            .from('favorite_courses')
            .select(`
              course_id,
              courses (id, title, image_url, description, drive_url)
            `)
            .eq('user_id', user.id);

          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2500));
          const res = await Promise.race([fetchPromise, timeoutPromise]) as any;

          if (res && !res.error && res.data) {
            const dbFavorites = res.data.filter((item: any) => item.courses !== null);
            
            // Fusionar sin duplicados
            const merged = [...dbFavorites];
            localFavCourses.forEach(localItem => {
              if (!merged.find(x => String(x.course_id) === String(localItem.course_id))) {
                merged.push(localItem);
              }
            });
            setFavorites(merged);
          }
        } catch (dbErr) {
          console.warn('Sincronización de favoritos en perfil lenta o fallida.');
        }
      } catch (err) {
        // Ignorar si falla el parseo
      }
    }
    fetchFavorites();
  }, [user]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    setSuccessMsg('');

    try {
      if (fullName !== profile?.full_name) {
        await supabase.from('users_profiles').update({ full_name: fullName }).eq('id', user.id);
      }
      if (password.trim().length >= 6) {
        await supabase.auth.updateUser({ password });
        setPassword('');
      }

      setSuccessMsg('Perfil actualizado correctamente.');
      useAuthStore.setState({ profile: { ...profile!, full_name: fullName }});
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setTimeout(() => setSuccessMsg(''), 3000);
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploadingAvatar(true);
      if (!event.target.files || event.target.files.length === 0 || !user) {
        throw new Error('Debes seleccionar una imagen.');
      }

      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}-${Math.random()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);

      await supabase.from('users_profiles').update({ avatar_url: publicUrl }).eq('id', user.id);
      
      useAuthStore.setState({ profile: { ...profile!, avatar_url: publicUrl }});
      setSuccessMsg('Foto de perfil actualizada.');
    } catch (error: any) {
      alert(error.message);
    } finally {
      setUploadingAvatar(false);
      setTimeout(() => setSuccessMsg(''), 3000);
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in pb-20">
      
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Mi Perfil</h2>
        <p className="text-gray-500 text-sm">Gestiona tu cuenta y preferencias.</p>
      </div>

      {/* Avatar & Basic Info */}
      <div className="flex items-center gap-5 bg-white/60 backdrop-blur-md rounded-3xl p-6 shadow-sm border border-white/80">
        <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
          <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-500 flex items-center justify-center text-white text-3xl font-bold shadow-md overflow-hidden">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              fullName.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U'
            )}
          </div>
          <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            {uploadingAvatar ? <Loader2 className="animate-spin text-white w-6 h-6" /> : <Camera className="text-white w-6 h-6" />}
          </div>
          <input 
            type="file" 
            accept="image/*" 
            ref={fileInputRef} 
            onChange={handleAvatarUpload} 
            className="hidden" 
            disabled={uploadingAvatar}
          />
        </div>
        <div>
          <h3 className="text-xl font-bold text-gray-900">{fullName || 'Usuario'}</h3>
          <p className="text-gray-500 text-sm">{user?.email}</p>
          <div className="mt-1 flex gap-2">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
              profile?.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
            }`}>
              {profile?.status === 'approved' ? 'Aprobado' : 'Pendiente'}
            </span>
          </div>
        </div>
      </div>

      {/* Acceso Especial para Administradores de Poder Absoluto */}
      {profile?.role === 'admin' && (
        <Link 
          to="/admin" 
          className="w-full flex items-center justify-between p-5 bg-gradient-to-r from-yellow-500/20 via-blue-500/10 to-indigo-500/20 border border-yellow-200/50 rounded-3xl hover:scale-[1.01] transition-all shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-yellow-500 to-amber-500 flex items-center justify-center text-white shadow-md">
              <Settings size={20} className="animate-spin" style={{ animationDuration: '6s' }} />
            </div>
            <div className="text-left">
              <p className="font-extrabold text-gray-900 text-sm">Panel de Administración</p>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Poder Absoluto • Aprobaciones & Control</p>
            </div>
          </div>
          <ChevronRight size={20} className="text-yellow-600" />
        </Link>
      )}

      {/* Mis Favoritos */}
      {favorites.length > 0 && (
        <div className="bg-white/60 backdrop-blur-md rounded-3xl p-6 shadow-sm border border-white/80">
          <h4 className="font-bold text-gray-900 mb-4">Mis Cursos Favoritos</h4>
          <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2">
            {favorites.map((fav) => (
              <Link 
                to={`/courses/${fav.courses?.id}`} 
                state={{ 
                  course: {
                    id: fav.courses?.id,
                    title: fav.courses?.title,
                    description: fav.courses?.description || '',
                    category: 'Todos',
                    image: fav.courses?.image_url || 'https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=800',
                    color: 'bg-blue-500',
                    drive_url: fav.courses?.drive_url || '#'
                  }
                }}
                key={fav.course_id} 
                className="min-w-[120px] max-w-[120px] flex flex-col gap-2 group"
              >
                <div className="h-24 rounded-2xl overflow-hidden shadow-sm relative">
                  <img src={fav.courses?.image_url} alt={fav.courses?.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                </div>
                <p className="text-xs font-semibold text-gray-700 line-clamp-2 leading-tight group-hover:text-blue-600 transition-colors">
                  {fav.courses?.title}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Settings Form */}
      <form onSubmit={handleUpdateProfile} className="bg-white/60 backdrop-blur-md rounded-3xl p-6 shadow-sm border border-white/80 flex flex-col gap-5">
        <h4 className="font-bold text-gray-900">Datos Personales</h4>
        
        {successMsg && (
          <div className="bg-green-50 text-green-600 p-3 rounded-lg text-sm border border-green-100">
            {successMsg}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Nombre Completo</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <User className="h-5 w-5 text-gray-400" />
            </div>
            <input 
              type="text" 
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="block w-full pl-10 pr-3 py-3 bg-white/50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all sm:text-sm" 
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Nueva Contraseña</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Lock className="h-5 w-5 text-gray-400" />
            </div>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Dejar en blanco para no cambiar"
              className="block w-full pl-10 pr-3 py-3 bg-white/50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all sm:text-sm" 
            />
          </div>
        </div>

        <button 
          type="submit" 
          disabled={loading}
          className="mt-2 w-full flex justify-center py-3 px-4 border border-transparent text-sm font-semibold rounded-xl text-white bg-gray-900 hover:bg-black focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black transition-all shadow-sm disabled:opacity-70"
        >
          {loading ? <Loader2 className="animate-spin h-5 w-5" /> : 'Guardar Cambios'}
        </button>
      </form>

      {/* Preferencias */}
      <div className="bg-white/60 backdrop-blur-md rounded-3xl p-2 shadow-sm border border-white/80 flex flex-col gap-1">
        <Link to="/favorites" className="w-full flex items-center justify-between p-4 hover:bg-gray-50/50 rounded-2xl transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-500">
              <Heart size={20} fill="currentColor" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-gray-900 text-sm">Mis Favoritos</p>
              <p className="text-xs text-gray-500">Cursos que he guardado</p>
            </div>
          </div>
          <ChevronRight size={20} className="text-gray-400" />
        </Link>

        <Link to="/study-plan" className="w-full flex items-center justify-between p-4 hover:bg-gray-50/50 rounded-2xl transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
              <Target size={20} />
            </div>
            <div className="text-left">
              <p className="font-semibold text-gray-900 text-sm">Plan de Estudio</p>
              <p className="text-xs text-gray-500">Organización y metas de aprendizaje</p>
            </div>
          </div>
          <ChevronRight size={20} className="text-gray-400" />
        </Link>

        <Link to="/subscription" className="w-full flex items-center justify-between p-4 hover:bg-gray-50/50 rounded-2xl transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
              <CreditCard size={20} />
            </div>
            <div className="text-left">
              <p className="font-semibold text-gray-900 text-sm">Membresía</p>
              <p className="text-xs text-gray-500">Mi plan y comprobantes de pago</p>
            </div>
          </div>
          <ChevronRight size={20} className="text-gray-400" />
        </Link>

        <Link to="/notifications" className="w-full flex items-center justify-between p-4 hover:bg-gray-50/50 rounded-2xl transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
              <Bell size={20} />
            </div>
            <div className="text-left">
              <p className="font-semibold text-gray-900 text-sm">Notificaciones</p>
              <p className="text-xs text-gray-500">Avisos y recordatorios</p>
            </div>
          </div>
          <ChevronRight size={20} className="text-gray-400" />
        </Link>

        <Link to="/support" className="w-full flex items-center justify-between p-4 hover:bg-gray-50/50 rounded-2xl transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
              <HelpCircle size={20} />
            </div>
            <div className="text-left">
              <p className="font-semibold text-gray-900 text-sm">Soporte y Ayuda</p>
              <p className="text-xs text-gray-500">FAQs y contacto de soporte</p>
            </div>
          </div>
          <ChevronRight size={20} className="text-gray-400" />
        </Link>
      </div>

      {/* Logout */}
      <button 
        onClick={signOut}
        className="mt-4 flex items-center justify-center gap-2 py-4 px-4 bg-red-50 text-red-600 rounded-2xl font-bold hover:bg-red-100 transition-colors"
      >
        <LogOut size={20} />
        Cerrar Sesión
      </button>

    </div>
  );
}
