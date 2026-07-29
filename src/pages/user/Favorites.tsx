import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Heart, Loader2 } from 'lucide-react';

const mockCourses = [
  { id: '3', title: 'De Cero a Criptoinversor', description: 'Entiende blockchain y criptomonedas.', category: 'Inversiones', image: 'https://images.unsplash.com/photo-1621416894569-0f39ed31d247?q=80&w=800' },
  { id: '2', title: 'Hábitos de Alta Productividad', description: 'Cómo organizar tu día para lograr más.', category: 'Desarrollo Personal', image: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?q=80&w=800' },
  { id: '1', title: 'Masterclass en Estrategia Digital', description: 'Aprende a crear embudos de venta.', category: 'Marketing Digital', image: 'https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=800' },
  { id: '4', title: 'Gestión de Equipos Remotos', description: 'Lidera equipos a distancia con éxito.', category: 'Negocios', image: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=800' },
  { id: '5', title: 'Psicología de Ventas', description: 'Vende más sin parecer que estás vendiendo.', category: 'Marketing Digital', image: 'https://images.unsplash.com/photo-1556761175-4b46a572b786?q=80&w=800' },
  { id: '6', title: 'Bolsa de Valores para Novatos', description: 'Tu primera inversión en acciones.', category: 'Inversiones', image: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?q=80&w=800' },
];

export function Favorites() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFavorites = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      // 1. Cargar favoritos locales (mocks) de localStorage AL INSTANTE (0ms)
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
            description: c.description,
            image_url: c.image,
            is_active: true,
            course_categories: { name: c.category }
          }
        }));

      // Renderizar el caché local de inmediato
      setFavorites(localFavCourses);
      setLoading(false);

      // 2. Cargar de base de datos real en segundo plano (Background Sync) con timeout de 2.5s
      try {
        const fetchPromise = supabase
          .from('favorite_courses')
          .select(`
            course_id,
            courses (
              id,
              title,
              description,
              image_url,
              is_active,
              course_categories (name)
            )
          `)
          .eq('user_id', user.id);

        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2500));
        const res = await Promise.race([fetchPromise, timeoutPromise]) as any;

        if (res && !res.error && res.data) {
          const dbFavorites = res.data.filter((item: any) => item.courses !== null);
          
          // Fusionar favoritos de la base de datos con los locales para que no haya duplicados
          const merged = [...dbFavorites];
          localFavCourses.forEach(localItem => {
            if (!merged.find(x => String(x.course_id) === String(localItem.course_id))) {
              merged.push(localItem);
            }
          });
          setFavorites(merged);
        }
      } catch (dbErr) {
        console.warn('Sincronización de favoritos en segundo plano pausada o en timeout. Usando caché local.');
      }
    } catch (err) {
      console.error('Error fetching favorites:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFavorites();
  }, [user]);

  const handleRemoveFavorite = async (e: React.MouseEvent, courseId: string) => {
    e.preventDefault(); // Evitar navegación al detalle del curso
    e.stopPropagation();
    if (!user) return;

    const isMock = !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(courseId);

    try {
      if (isMock) {
        // Quitar de localStorage
        const localKey = `local_favorites_${user.id}`;
        const localSaved = localStorage.getItem(localKey) || '[]';
        let localFavs = JSON.parse(localSaved);
        localFavs = localFavs.filter((cid: string) => String(cid) !== String(courseId));
        localStorage.setItem(localKey, JSON.stringify(localFavs));
        setFavorites(favorites.filter(fav => String(fav.course_id) !== String(courseId)));
      } else {
        // Quitar de base de datos
        const { error } = await supabase
          .from('favorite_courses')
          .delete()
          .eq('user_id', user.id)
          .eq('course_id', courseId);

        if (error) throw error;
        setFavorites(favorites.filter(fav => String(fav.course_id) !== String(courseId)));
      }
    } catch (err) {
      console.error('Error removing favorite:', err);
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in pb-20">
      
      {/* Header */}
      <div className="flex items-center gap-3">
        <button 
          onClick={() => navigate('/profile')}
          className="w-10 h-10 bg-white/60 backdrop-blur-md rounded-full flex items-center justify-center text-gray-700 hover:bg-white shadow-sm transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Mis Favoritos</h2>
          <p className="text-xs text-gray-500">Cursos que has guardado para ver después.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="animate-spin text-blue-500" />
        </div>
      ) : favorites.length === 0 ? (
        <div className="text-center py-12 bg-white/60 backdrop-blur-md rounded-3xl border border-white/80 flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center">
            <Heart size={28} />
          </div>
          <div>
            <h3 className="font-bold text-gray-900">Aún no tienes favoritos</h3>
            <p className="text-gray-500 text-xs mt-1 leading-relaxed max-w-[240px] mx-auto">
              Explora el catálogo de cursos y presiona el ícono del corazón para guardarlos aquí.
            </p>
          </div>
          <button 
            onClick={() => navigate('/courses')}
            className="mt-2 py-2.5 px-6 bg-gray-900 text-white rounded-xl font-semibold text-xs hover:bg-black transition-colors"
          >
            Explorar Cursos
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {favorites.map((fav) => {
            const course = fav.courses;
            return (
              <Link 
                to={`/courses/${course.id}`} 
                state={{ 
                  course: {
                    id: course.id,
                    title: course.title,
                    description: course.description,
                    category: course.course_categories?.name || 'Todos',
                    image: course.image_url || 'https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=800',
                    color: 'bg-blue-500',
                    drive_url: '#'
                  }
                }}
                key={course.id}
                className="bg-white/85 backdrop-blur-md rounded-3xl p-4 flex gap-4 border border-white/80 shadow-sm hover:scale-[1.01] transition-all group relative"
              >
                {/* Imagen del Curso */}
                <div className="w-24 h-24 rounded-2xl overflow-hidden shrink-0 shadow-sm bg-gray-100">
                  <img 
                    src={course.image_url || 'https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=800'} 
                    alt={course.title} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>

                {/* Info del Curso */}
                <div className="flex flex-col justify-between py-1 flex-1 min-w-0 pr-8">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase text-blue-600 tracking-wider">
                      {course.course_categories?.name || 'Todos'}
                    </span>
                    <h4 className="font-bold text-gray-900 text-sm leading-snug mt-0.5 line-clamp-1 group-hover:text-blue-600 transition-colors">
                      {course.title}
                    </h4>
                    <p className="text-gray-500 text-xs mt-1 line-clamp-2 leading-normal">
                      {course.description}
                    </p>
                  </div>
                </div>

                {/* Botón de Quitar Favorito */}
                <button 
                  onClick={(e) => handleRemoveFavorite(e, course.id)}
                  className="absolute right-4 top-4 w-8 h-8 rounded-full bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center shadow-sm transition-colors"
                >
                  <Heart size={16} fill="currentColor" />
                </button>
              </Link>
            );
          })}
        </div>
      )}

    </div>
  );
}
