import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, PlayCircle, ChevronLeft, ChevronRight, Sparkles, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

// Datos de prueba como fallback para no romper la app si la DB está vacía
const mockCourses = [
  { id: '3', title: 'De Cero a Criptoinversor', description: 'Entiende blockchain y criptomonedas.', category: 'Inversiones', image: 'https://images.unsplash.com/photo-1621416894569-0f39ed31d247?q=80&w=800', color: 'bg-emerald-500', created_at: '2026-05-03T10:00:00Z' },
  { id: '2', title: 'Hábitos de Alta Productividad', description: 'Cómo organizar tu día para lograr más.', category: 'Desarrollo Personal', image: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?q=80&w=800', color: 'bg-purple-500', created_at: '2026-05-02T10:00:00Z' },
  { id: '1', title: 'Masterclass en Estrategia Digital', description: 'Aprende a crear embudos de venta.', category: 'Marketing Digital', image: 'https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=800', color: 'bg-blue-500', created_at: '2026-05-01T10:00:00Z' },
  { id: '4', title: 'Gestión de Equipos Remotos', description: 'Lidera equipos a distancia con éxito.', category: 'Negocios', image: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=800', color: 'bg-orange-500', created_at: '2026-04-30T10:00:00Z' },
  { id: '5', title: 'Psicología de Ventas', description: 'Vende más sin parecer que estás vendiendo.', category: 'Marketing Digital', image: 'https://images.unsplash.com/photo-1556761175-4b46a572b786?q=80&w=800', color: 'bg-blue-500', created_at: '2026-04-29T10:00:00Z' },
  { id: '6', title: 'Bolsa de Valores para Novatos', description: 'Tu primera inversión en acciones.', category: 'Inversiones', image: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?q=80&w=800', color: 'bg-emerald-500', created_at: '2026-04-28T10:00:00Z' },
];

const categories = ['Todos', 'Marketing Digital', 'Desarrollo Personal', 'Inversiones', 'Negocios'];
const COURSES_PER_PAGE = 3;

export function Courses() {
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('Todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [onlyLastTen, setOnlyLastTen] = useState(false);

  useEffect(() => {
    // 1. Cargar caché inmediatamente para UI Optimista
    const cached = localStorage.getItem('cached_courses');
    if (cached) {
      try {
        setCourses(JSON.parse(cached));
        setLoading(false);
      } catch (err) {
        console.warn('Error al parsear cursos en caché:', err);
      }
    }

    async function fetchCourses() {
      // Timeout de seguridad de 4 segundos
      const timeoutPromise = new Promise((resolve) => {
        setTimeout(() => resolve({ data: null, error: new Error('Timeout') }), 4000);
      });

      try {
        const queryPromise = supabase
          .from('courses')
          .select(`
            id,
            title,
            description,
            image_url,
            is_active,
            created_at,
            course_categories (name)
          `)
          .eq('is_active', true);

        // Competencia de promesas
        const { data, error } = await Promise.race([queryPromise, timeoutPromise]) as any;

        if (!error && data && data.length > 0) {
          const mapped = data.map((item: any) => ({
            id: item.id,
            title: item.title,
            description: item.description,
            category: item.course_categories?.name || 'Todos',
            image: item.image_url || 'https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=800',
            color: 'bg-blue-500', // Default color, fallback
            created_at: item.created_at
          }));
          setCourses(mapped);
          localStorage.setItem('cached_courses', JSON.stringify(mapped));
        } else if (!cached) {
          // Solo usar mocks si no hay absolutamente nada en caché
          setCourses(mockCourses);
          localStorage.setItem('cached_courses', JSON.stringify(mockCourses));
        }
      } catch (err) {
        if (!cached) {
          setCourses(mockCourses);
          localStorage.setItem('cached_courses', JSON.stringify(mockCourses));
        }
      } finally {
        setLoading(false);
      }
    }
    fetchCourses();
  }, []);

  // 1. ORDENAR MAS RECIENTES PRIMERO
  const sortedCourses = [...courses].sort((a, b) => {
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  // 2. OPCION DE MOSTRAR SOLO LOS ULTIMOS 10 SUBIDOS
  const limitFilteredCourses = onlyLastTen ? sortedCourses.slice(0, 10) : sortedCourses;

  // 3. FILTRADO POR CATEGORIA Y BUSQUEDA
  const filteredCourses = limitFilteredCourses.filter(course => {
    const matchesCategory = activeCategory === 'Todos' || course.category === activeCategory;
    const matchesSearch = course.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Paginación
  const totalPages = Math.ceil(filteredCourses.length / COURSES_PER_PAGE);
  const startIndex = (currentPage - 1) * COURSES_PER_PAGE;
  const currentCourses = filteredCourses.slice(startIndex, startIndex + COURSES_PER_PAGE);

  // Reset page when filters change
  const handleCategoryChange = (cat: string) => {
    setActiveCategory(cat);
    setCurrentPage(1);
  };
  
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  const toggleLastTen = () => {
    setOnlyLastTen(!onlyLastTen);
    setCurrentPage(1);
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in pb-20">
      
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Catálogo</h2>
        <p className="text-gray-500 text-sm">Explora todos los cursos disponibles.</p>
      </div>

      {/* Buscador */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input 
          type="text" 
          placeholder="¿Qué quieres aprender hoy?" 
          value={searchQuery}
          onChange={handleSearchChange}
          className="block w-full pl-11 pr-4 py-3.5 bg-white/60 backdrop-blur-md border border-white/80 rounded-2xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 shadow-sm transition-all"
        />
        <div className="absolute inset-y-0 right-0 pr-2 flex items-center">
          <button 
            onClick={toggleLastTen}
            className={`p-2 rounded-xl flex items-center gap-1.5 text-xs font-bold transition-all ${
              onlyLastTen 
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Sparkles size={16} />
            <span>Últimos 10</span>
          </button>
        </div>
      </div>

      {/* Categorías (Scroll horizontal) */}
      <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2 -mx-2 px-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => handleCategoryChange(cat)}
            className={`whitespace-nowrap px-5 py-2 rounded-full text-sm font-semibold transition-all shadow-sm ${
              activeCategory === cat 
                ? 'bg-gray-900 text-white' 
                : 'bg-white/70 text-gray-600 hover:bg-white border border-transparent'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Lista de Cursos */}
      <div className="flex flex-col gap-5">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-blue-500" /></div>
        ) : currentCourses.length > 0 ? (
          currentCourses.map((course) => (
            <Link key={course.id} to={`/courses/${course.id}`} state={{ course }} className="bg-white/80 backdrop-blur-md rounded-[2rem] p-3 shadow-sm border border-white flex flex-col group hover:shadow-md transition-all">
              <div className="h-48 w-full rounded-3xl overflow-hidden relative mb-4">
                <img src={course.image} alt={course.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                <div className="absolute top-3 left-3">
                  <span className={`${course.color} text-white text-[10px] font-bold px-3 py-1.5 rounded-full shadow-sm`}>
                    {course.category}
                  </span>
                </div>
                {/* Overlay Play Button on hover */}
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <PlayCircle className="text-white w-12 h-12 drop-shadow-lg" strokeWidth={1.5} />
                </div>
              </div>
              <div className="px-2 pb-2">
                <h3 className="text-xl font-bold text-gray-900 leading-tight mb-2">{course.title}</h3>
                <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed">{course.description}</p>
              </div>
            </Link>
          ))
        ) : (
          <div className="text-center py-10 bg-white/40 rounded-3xl border border-white/60">
            <p className="text-gray-500 font-medium">No se encontraron cursos.</p>
          </div>
        )}
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 mt-2">
          <button 
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 text-gray-700"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="text-sm font-semibold text-gray-600">
            {currentPage} de {totalPages}
          </span>
          <button 
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 text-gray-700"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      )}

    </div>
  );
}
