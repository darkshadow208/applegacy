import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Play, Star, AlertCircle, Calendar } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';

export function Dashboard() {
  const { profile } = useAuthStore();
  const [latestCourses, setLatestCourses] = useState<any[]>([]);
  const [activeAnnouncements, setActiveAnnouncements] = useState<any[]>([]);
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [subStatus, setSubStatus] = useState<string>('pending');

  useEffect(() => {
    async function fetchData() {
      // A. Cargar Últimos Cursos con Fallback Blindado
      try {
        const { data: coursesData, error: coursesError } = await supabase
          .from('courses')
          .select(`
            id, title, description, image_url,
            course_categories (name)
          `)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(2);

        if (coursesError) throw coursesError;
        if (coursesData) {
          setLatestCourses(coursesData);
        }
      } catch (err) {
        console.error('Error cargando ultimos cursos con join, intentando fallback simple:', err);
        try {
          const { data: fallbackData } = await supabase
            .from('courses')
            .select('*')
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(2);

          if (fallbackData) {
            setLatestCourses(fallbackData);
          }
        } catch (innerErr) {
          console.error('Fallback de cursos falló también:', innerErr);
        }
      }

      // B. Cargar Anuncios de Aviso de Inicio
      try {
        const { data: annData, error: annError } = await supabase
          .from('news_posts')
          .select('*')
          .eq('type', 'announcement')
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        if (annError) throw annError;
        if (annData) {
          setActiveAnnouncements(annData);
        }
      } catch (err) {
        console.error('Error cargando avisos generales:', err);
      }

      // C. Cargar Membresía y días restantes reales (Resistente a filas inexistentes)
      try {
        if (profile?.id) {
          const { data: subData, error: subError } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('user_id', profile.id)
            .maybeSingle();

          if (subError) throw subError;

          if (subData) {
            setSubStatus(subData.status);
            if (subData.end_date) {
              const diffTime = new Date(subData.end_date).getTime() - new Date().getTime();
              const calculatedDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              setDaysLeft(calculatedDays > 0 ? calculatedDays : 0);
            } else {
              setDaysLeft(null);
            }
          }
        }
      } catch (err) {
        console.error('Error cargando suscripción en inicio:', err);
      }
    }
    fetchData();

    // Suscripción en tiempo real para cambios en los avisos
    const channel = supabase
      .channel('announcements-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'news_posts'
        },
        async () => {
          try {
            const { data: annData } = await supabase
              .from('news_posts')
              .select('*')
              .eq('type', 'announcement')
              .eq('is_active', true)
              .order('created_at', { ascending: false });

            if (annData) {
              setActiveAnnouncements(annData);
            }
          } catch (err) {
            console.error('Error actualizando avisos en tiempo real:', err);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile]);

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      
      {/* Header section */}
      <div className="flex flex-col gap-1">
        <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Hola, {profile?.full_name?.split(' ')[0] || 'Usuario'}</h2>
        <p className="text-gray-500 text-sm">Qué bueno verte de nuevo. ¡Sigue creciendo!</p>
      </div>

      {/* Avisos de la Academia (Banners superiores dinámicos para Estudiantes) */}
      {profile?.role !== 'admin' && activeAnnouncements.length > 0 && (
        <div className="flex flex-col gap-3">
          {activeAnnouncements.map((ann) => (
            <div key={ann.id} className="bg-yellow-50 border border-yellow-250 rounded-[2rem] p-5 flex gap-3.5 items-start animate-pulse shadow-sm">
              <AlertCircle className="text-yellow-600 shrink-0 mt-0.5" size={20} />
              <div className="flex-1">
                <h4 className="text-xs font-bold text-yellow-800 uppercase tracking-wider">Aviso de la Academia</h4>
                <p className="text-xs text-yellow-700 mt-1 font-semibold leading-relaxed whitespace-pre-wrap">{ann.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Subscription Status Card */}
      <div className="bg-white/60 backdrop-blur-md rounded-[2rem] p-6 shadow-sm border border-white/80 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-400/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
        <div className="flex justify-between items-start relative z-10">
          <div>
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">Membresía</p>
            <h3 className="text-xl font-bold text-gray-900 capitalize">
              {subStatus === 'active' ? 'Activa' : subStatus === 'pending' ? 'Pendiente' : 'Expirada'}
            </h3>
             <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
               <Calendar size={14} /> 
               {daysLeft !== null 
                 ? (daysLeft > 0 ? `Vence en ${daysLeft} ${daysLeft === 1 ? 'día' : 'días'}` : 'Ya expirada')
                 : 'En espera de aprobación'}
            </p>
          </div>
          <Link to="/subscription" className="bg-white px-4 py-2 rounded-full text-sm font-semibold text-gray-800 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            Ver detalles
          </Link>
        </div>
      </div>

      {/* Latest Courses Section */}
      <div>
        <div className="flex justify-between items-end mb-3">
          <h3 className="text-lg font-bold text-gray-900">Últimos Cursos</h3>
          <Link to="/courses" className="text-sm font-medium text-blue-600 hover:underline">Ver todos</Link>
        </div>
        
        <div className="flex flex-col gap-4">
          {latestCourses.length > 0 ? latestCourses.map((course) => (
            <Link key={course.id} to={`/courses/${course.id}`} className="block relative group rounded-[2rem] overflow-hidden shadow-sm border border-gray-100 bg-white">
              <div className="h-40 bg-gray-200 relative">
                <img src={course.image_url || 'https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=800'} alt={course.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                <div className="absolute bottom-4 left-4 right-4">
                  <span className="bg-blue-500 text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider">
                    {course.course_categories?.name || 'General'}
                  </span>
                  <h4 className="text-white font-bold text-lg mt-1 leading-tight">{course.title}</h4>
                </div>
              </div>
              <div className="p-4 flex justify-between items-center bg-white relative z-10">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                    <Play size={14} fill="currentColor" />
                  </div>
                  <span className="text-sm font-semibold text-gray-700">Ver curso</span>
                </div>
                <ArrowRight size={18} className="text-gray-400 group-hover:text-blue-500 transition-colors" />
              </div>
            </Link>
          )) : (
            <div className="text-center py-10 bg-white/50 rounded-[2rem] border border-white border-dashed">
              <p className="text-gray-500 text-xs font-bold">No hay cursos recientes publicados.</p>
            </div>
          )}
        </div>
      </div>

      {/* Two Column Grid for Bonuses & Blog */}
      <div className="grid grid-cols-2 gap-4">
        {/* Bonuses */}
        <Link to="/bonuses" className="bg-gradient-to-br from-purple-500 to-indigo-500 rounded-[2rem] p-5 text-white shadow-lg shadow-purple-500/20 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-xl -mr-8 -mt-8"></div>
          <Star className="text-purple-200 mb-3" size={28} />
          <h4 className="font-bold text-lg leading-tight">Bonos</h4>
          <p className="text-purple-100 text-xs mt-1">Recursos VIP</p>
        </Link>

        {/* Blog */}
        <Link to="/blog" className="bg-white rounded-[2rem] p-5 shadow-sm border border-gray-100 group">
          <div className="w-10 h-10 rounded-full bg-pink-100 text-pink-600 flex items-center justify-center mb-3 group-hover:bg-pink-500 group-hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/></svg>
          </div>
          <h4 className="font-bold text-gray-900 text-lg leading-tight">Blog</h4>
          <p className="text-gray-500 text-xs mt-1">Últimas noticias</p>
        </Link>
      </div>

      {/* Bottom spacer for nav bar */}
      <div className="h-6"></div>

    </div>
  );
}
