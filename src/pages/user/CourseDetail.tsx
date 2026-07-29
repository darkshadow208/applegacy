import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Play, Share2, Heart, Loader2, Clock, Target, Award, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';

// Helper de validación de formato UUID para evitar errores de casteo en base de datos
const isValidUUID = (val: string) => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
};

// Reusando mock data completo de Courses para máxima cobertura
const mockCourses = [
  { id: '3', title: 'De Cero a Criptoinversor', description: 'Entiende blockchain y criptomonedas.', category: 'Inversiones', image: 'https://images.unsplash.com/photo-1621416894569-0f39ed31d247?q=80&w=800', color: 'bg-emerald-500', drive_url: '#', level: 'Avanzado' },
  { id: '2', title: 'Hábitos de Alta Productividad', description: 'Cómo organizar tu día para lograr más.', category: 'Desarrollo Personal', image: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?q=80&w=800', color: 'bg-purple-500', drive_url: '#', level: 'Principiante' },
  { id: '1', title: 'Masterclass en Estrategia Digital', description: 'Aprende a crear embudos de venta.', category: 'Marketing Digital', image: 'https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=800', color: 'bg-blue-500', drive_url: '#', level: 'Intermedio' },
  { id: '4', title: 'Gestión de Equipos Remotos', description: 'Lidera equipos a distancia con éxito.', category: 'Negocios', image: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=800', color: 'bg-orange-500', drive_url: '#', level: 'Intermedio' },
  { id: '5', title: 'Psicología de Ventas', description: 'Vende más sin parecer que estás vendiendo.', category: 'Marketing Digital', image: 'https://images.unsplash.com/photo-1556761175-4b46a572b786?q=80&w=800', color: 'bg-blue-500', drive_url: '#', level: 'Principiante' },
  { id: '6', title: 'Bolsa de Valores para Novatos', description: 'Tu primera inversión en acciones.', category: 'Inversiones', image: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?q=80&w=800', color: 'bg-emerald-500', drive_url: '#', level: 'Avanzado' },
];

export function CourseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();

  // 1. Obtener curso optimista de forma jerárquica (state > sessionStorage cache > mock fallback)
  let initialCourse = location.state?.course || null;
  if (!initialCourse && id) {
    try {
      const cached = sessionStorage.getItem('cached_courses');
      if (cached) {
        const parsed = JSON.parse(cached);
        const found = parsed.find((c: any) => String(c.id) === String(id));
        if (found) {
          initialCourse = {
            id: found.id,
            title: found.title,
            description: found.description,
            category: found.category || 'Todos',
            image: found.image || 'https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=800',
            color: 'bg-blue-500',
            drive_url: found.drive_url || '#',
            level: 'Intermedio'
          };
        }
      }
    } catch (e) {
      console.error(e);
    }
  }

  if (!initialCourse && id) {
    const mock = mockCourses.find(c => String(c.id) === String(id));
    if (mock) {
      initialCourse = mock;
    }
  }

  const [course, setCourse] = useState<any>(initialCourse);
  const [loading, setLoading] = useState(!initialCourse); // Si ya tenemos curso optimista, ¡espera cero!
  const [isFavorite, setIsFavorite] = useState(false);
  const [loadingFav, setLoadingFav] = useState(false);
  const [studyStatus, setStudyStatus] = useState<'pending' | 'progress' | 'completed'>('pending');

  // Cargar estado del plan de estudio local
  useEffect(() => {
    if (!user || !id) return;
    try {
      const storageKey = `study_plan_${user.id}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.courseConfigs && parsed.courseConfigs[id]) {
          setStudyStatus(parsed.courseConfigs[id].status || 'pending');
        }
      }
    } catch (e) {
      console.error(e);
    }
  }, [user, id]);

  const handleUpdateStudyStatus = (newStatus: 'pending' | 'progress' | 'completed') => {
    if (!user || !id) return;
    try {
      const storageKey = `study_plan_${user.id}`;
      const saved = localStorage.getItem(storageKey) || '{}';
      const parsed = JSON.parse(saved);
      
      if (!parsed.courseConfigs) parsed.courseConfigs = {};
      parsed.courseConfigs[id] = {
        ...(parsed.courseConfigs[id] || { priority: 'medium' }),
        status: newStatus
      };
      
      localStorage.setItem(storageKey, JSON.stringify(parsed));
      setStudyStatus(newStatus);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    async function loadCourseAndFavorite() {
      if (!id) return;
      
      // Si no tenemos el curso optimista, mostramos cargador temporal
      if (!course) {
        setLoading(true);
      }

      // Si el ID es de pruebas (no es un UUID válido), no llamamos a la base de datos
      if (!isValidUUID(id)) {
        if (!course) {
          const mock = mockCourses.find(c => String(c.id) === String(id)) || mockCourses[0];
          setCourse(mock);
        }
        
        // Cargar favoritos locales
        if (user) {
          const localKey = `local_favorites_${user.id}`;
          const localSaved = localStorage.getItem(localKey) || '[]';
          const localFavs = JSON.parse(localSaved);
          if (localFavs.includes(id)) {
            setIsFavorite(true);
          }
        }
        setLoading(false);
        return;
      }

      try {
        // 1. Cargar datos del curso sin esperas competitivas restrictivas
        const { data: dbCourse, error: courseError } = await supabase
          .from('courses')
          .select(`
            id,
            title,
            description,
            image_url,
            drive_url,
            is_active,
            created_at,
            course_categories (name)
          `)
          .eq('id', id)
          .single();

        if (!courseError && dbCourse) {
          const categoryName = Array.isArray(dbCourse.course_categories)
            ? (dbCourse.course_categories[0] as any)?.name
            : (dbCourse.course_categories as any)?.name;
          setCourse({
            id: dbCourse.id,
            title: dbCourse.title,
            description: dbCourse.description,
            category: categoryName || 'Todos',
            image: dbCourse.image_url || 'https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=800',
            color: 'bg-blue-500',
            drive_url: dbCourse.drive_url || '#',
            level: 'Intermedio'
          });
        } else if (!course) {
          const mock = mockCourses.find(c => c.id === id) || mockCourses[0];
          setCourse(mock);
        }

        // LIBERAMOS LA PANTALLA DE CARGA DEL CURSO DE INMEDIATO
        setLoading(false);

        // 2. Cargar favoritos de forma asíncrona en segundo plano (No bloquea la carga de la página)
        if (user) {
          supabase
            .from('favorite_courses')
            .select('*')
            .eq('user_id', user.id)
            .eq('course_id', id)
            .maybeSingle()
            .then(
              ({ data: favData }) => {
                if (favData) {
                  setIsFavorite(true);
                }
              },
              () => {
                // Fallback a almacenamiento local silencioso
                const localKey = `local_favorites_${user.id}`;
                const localSaved = localStorage.getItem(localKey) || '[]';
                const localFavs = JSON.parse(localSaved);
                if (localFavs.includes(id)) {
                  setIsFavorite(true);
                }
              }
            );
        }
      } catch (err) {
        console.error(err);
        if (!course) {
          const mock = mockCourses.find(c => c.id === id) || mockCourses[0];
          setCourse(mock);
        }
        setLoading(false);
      }
    }
    loadCourseAndFavorite();
  }, [id, user]);

  const toggleFavorite = async () => {
    if (!user || !course) return;
    setLoadingFav(true);
    const isMock = !isValidUUID(course.id);

    try {
      if (isMock) {
        const localKey = `local_favorites_${user.id}`;
        const localSaved = localStorage.getItem(localKey) || '[]';
        let localFavs = JSON.parse(localSaved);
        if (isFavorite) {
          localFavs = localFavs.filter((cid: string) => cid !== course.id);
          setIsFavorite(false);
        } else {
          localFavs.push(course.id);
          setIsFavorite(true);
        }
        localStorage.setItem(localKey, JSON.stringify(localFavs));
      } else {
        if (isFavorite) {
          const { error } = await supabase.from('favorite_courses').delete().eq('user_id', user.id).eq('course_id', course.id);
          if (error) {
            const localKey = `local_favorites_${user.id}`;
            const localSaved = localStorage.getItem(localKey) || '[]';
            let localFavs = JSON.parse(localSaved);
            localFavs = localFavs.filter((cid: string) => cid !== course.id);
            localStorage.setItem(localKey, JSON.stringify(localFavs));
            setIsFavorite(false);
          } else {
            setIsFavorite(false);
          }
        } else {
          const { error } = await supabase.from('favorite_courses').insert({ user_id: user.id, course_id: course.id });
          if (error) {
            const localKey = `local_favorites_${user.id}`;
            const localSaved = localStorage.getItem(localKey) || '[]';
            let localFavs = JSON.parse(localSaved);
            if (!localFavs.includes(course.id)) {
              localFavs.push(course.id);
              localStorage.setItem(localKey, JSON.stringify(localFavs));
            }
            setIsFavorite(true);
          } else {
            setIsFavorite(true);
          }
        }
      }
    } catch (err) {
      console.error(err);
      const localKey = `local_favorites_${user.id}`;
      const localSaved = localStorage.getItem(localKey) || '[]';
      let localFavs = JSON.parse(localSaved);
      if (isFavorite) {
        localFavs = localFavs.filter((cid: string) => cid !== course.id);
        setIsFavorite(false);
      } else {
        if (!localFavs.includes(course.id)) localFavs.push(course.id);
        setIsFavorite(true);
      }
      localStorage.setItem(localKey, JSON.stringify(localFavs));
    } finally {
      setLoadingFav(false);
    }
  };

  if (loading || !course) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-blue-500 w-10 h-10" />
      </div>
    );
  }

  return (
    <div className="flex flex-col animate-fade-in pb-20">
      
      {/* Controles superiores */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <button 
            onClick={() => navigate('/courses')}
            className="w-10 h-10 bg-white/60 backdrop-blur-md rounded-full flex items-center justify-center text-gray-700 hover:bg-white shadow-sm transition-colors cursor-pointer"
          >
            <ArrowLeft size={20} />
          </button>
          <span className="ml-3 font-semibold text-gray-700">Volver</span>
        </div>
        
        <button 
          onClick={toggleFavorite}
          disabled={loadingFav}
          className={`w-10 h-10 rounded-full flex items-center justify-center shadow-sm transition-colors cursor-pointer ${
            isFavorite ? 'bg-red-50 text-red-500 hover:bg-red-100' : 'bg-white/60 text-gray-400 hover:bg-white hover:text-red-500'
          }`}
        >
          <Heart size={20} fill={isFavorite ? 'currentColor' : 'none'} />
        </button>
      </div>

      {/* Imagen Hero */}
      <div className="h-72 relative rounded-[2rem] overflow-hidden shadow-sm">
        <img src={course.image} alt={course.title} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900/90 via-gray-900/30 to-transparent"></div>
        
        <div className="absolute bottom-6 left-6 right-6 flex flex-col gap-2">
          <div className="flex gap-2">
            <span className={`${course.color} text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm`}>
              {course.category}
            </span>
            <span className="bg-white/20 backdrop-blur-md text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm">
              {course.level}
            </span>
          </div>
          <h1 className="text-3xl font-bold text-white leading-tight mt-1">{course.title}</h1>
        </div>
      </div>

      {/* Contenido Principal */}
      <div className="mt-6 flex flex-col gap-6">
        
        {/* Acciones principales */}
        <div className="flex gap-3">
          <a 
            href={course.drive_url} 
            target="_blank" 
            rel="noreferrer"
            className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl py-3.5 flex items-center justify-center gap-2 font-bold shadow-lg shadow-blue-500/30 hover:scale-[1.02] transition-transform"
          >
            <Play size={20} fill="currentColor" />
            Acceder al Curso
          </a>
          <button className="w-14 h-14 bg-white rounded-2xl border border-gray-100 shadow-sm flex items-center justify-center text-gray-500 hover:text-blue-600 transition-colors">
            <Share2 size={20} />
          </button>
        </div>

        {/* Widget del Plan de Estudio */}
        {studyStatus === 'pending' && (
          <div className="bg-white/60 backdrop-blur-md rounded-3xl p-5 border border-white/80 shadow-sm flex flex-col gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                <Target size={16} />
              </div>
              <div>
                <h4 className="font-bold text-xs text-gray-900">¿Listo para empezar este curso?</h4>
                <p className="text-[10px] text-gray-500">Agrégalo a tu plan de estudio activo.</p>
              </div>
            </div>
            <button 
              onClick={() => handleUpdateStudyStatus('progress')}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              🚀 Empezar a estudiar
            </button>
          </div>
        )}

        {studyStatus === 'progress' && (
          <div className="bg-white/60 backdrop-blur-md rounded-3xl p-5 border border-white/80 shadow-sm flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center animate-pulse">
                  <Clock size={16} />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-gray-900">Curso en progreso</h4>
                  <p className="text-[10px] text-gray-500">Está en tu lista de "Continuar viendo".</p>
                </div>
              </div>
              <span className="text-[9px] font-extrabold uppercase bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full tracking-wider">Estudiando</span>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => handleUpdateStudyStatus('completed')}
                className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold shadow transition-colors flex items-center justify-center gap-1 cursor-pointer"
              >
                <Check size={14} /> Completado
              </button>
              <button 
                onClick={() => handleUpdateStudyStatus('pending')}
                className="py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Pausar
              </button>
            </div>
          </div>
        )}

        {studyStatus === 'completed' && (
          <div className="bg-gradient-to-tr from-green-50 to-emerald-50 rounded-3xl p-5 border border-green-100 shadow-sm flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center shadow-sm">
                  <Award size={16} />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-green-900">🏆 ¡Curso Completado!</h4>
                  <p className="text-[10px] text-green-700">Completaste este curso con éxito.</p>
                </div>
              </div>
              <span className="text-[9px] font-extrabold uppercase bg-green-500 text-white px-2 py-0.5 rounded-full tracking-wider">Completado</span>
            </div>
            <button 
              onClick={() => handleUpdateStudyStatus('progress')}
              className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold shadow transition-colors cursor-pointer"
            >
              🔄 Reiniciar / Estudiar de nuevo
            </button>
          </div>
        )}

        {/* Descripción */}
        <div className="bg-white/60 backdrop-blur-md rounded-3xl p-6 shadow-sm border border-white/80">
          <h3 className="text-lg font-bold text-gray-900 mb-3">Sobre este curso</h3>
          <p className="text-gray-600 leading-relaxed text-sm">
            {course.description}
          </p>
        </div>

      </div>
    </div>
  );
}
