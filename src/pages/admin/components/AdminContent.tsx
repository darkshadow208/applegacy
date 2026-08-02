import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { 
  PlusCircle, 
  Sparkles, 
  FileEdit, 
  Loader2, 
  X
} from 'lucide-react';

interface AdminContentProps {
  showToast: (text: string, type?: 'success' | 'error' | 'info') => void;
}

const ITEMS_PER_PAGE = 4;

export function AdminContent({ showToast }: AdminContentProps) {
  // --- STATES ---
  const [courses, setCourses] = useState<any[]>([]);
  const [coursesCount, setCoursesCount] = useState(0);
  const [pageCourses, setPageCourses] = useState(1);

  const [bonuses, setBonuses] = useState<any[]>([]);
  const [bonusesCount, setBonusesCount] = useState(0);
  const [pageBonuses, setPageBonuses] = useState(1);

  const [categories, setCategories] = useState<any[]>([]);

  // Courses form
  const [courseTitle, setCourseTitle] = useState('');
  const [courseDesc, setCourseDesc] = useState('');
  const [courseDriveUrl, setCourseDriveUrl] = useState('');
  const [courseImageUrl, setCourseImageUrl] = useState('');
  const [courseCategory, setCourseCategory] = useState('');
  
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [editingCourseTitle, setEditingCourseTitle] = useState('');
  const [editingCourseDesc, setEditingCourseDesc] = useState('');

  // Bonuses form
  const [bonusTitle, setBonusTitle] = useState('');
  const [bonusDesc, setBonusDesc] = useState('');
  const [bonusDriveUrl, setBonusDriveUrl] = useState('');
  const [bonusIsGlobal, setBonusIsGlobal] = useState(true);

  const [editingBonusId, setEditingBonusId] = useState<string | null>(null);
  const [editingBonusTitle, setEditingBonusTitle] = useState('');
  const [editingBonusDesc, setEditingBonusDesc] = useState('');

  // Categories form
  const [newCategoryName, setNewCategoryName] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);

  // --- FETCHERS ---
  const fetchCourses = async (page: number) => {
    try {
      const { data, count, error } = await supabase
        .from('courses')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE - 1);
      
      if (error) throw error;
      setCourses(data || []);
      setCoursesCount(count || 0);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchBonuses = async (page: number) => {
    try {
      const { data, count, error } = await supabase
        .from('bonuses')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE - 1);
      
      if (error) throw error;
      setBonuses(data || []);
      setBonusesCount(count || 0);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase.from('course_categories').select('*');
      if (error) throw error;
      setCategories(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchCourses(pageCourses);
  }, [pageCourses]);

  useEffect(() => {
    fetchBonuses(pageBonuses);
  }, [pageBonuses]);

  // --- COURSES ACTIONS ---
  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseTitle.trim() || !courseDriveUrl.trim()) return;

    try {
      const { error } = await supabase.from('courses').insert({
        title: courseTitle,
        description: courseDesc,
        drive_url: courseDriveUrl,
        image_url: courseImageUrl || 'https://images.unsplash.com/photo-1516321497487-e288fb19713f?q=80&w=800',
        category_id: courseCategory || null,
        is_active: true
      });

      if (error) throw error;

      await supabase.from('notifications').insert({
        user_id: null,
        title: '🚀 ¡Nuevo Curso Disponible!',
        message: `Se ha publicado el curso "${courseTitle}". ¡Ve a revisarlo!`,
        is_read: false
      });

      showToast('🎉 ¡Curso publicado exitosamente!', 'success');
      setCourseTitle(''); setCourseDesc(''); setCourseDriveUrl(''); setCourseImageUrl(''); setCourseCategory('');
      fetchCourses(pageCourses);
    } catch (err: any) {
      console.error(err);
      showToast(`Error al crear curso: ${err.message}`, 'error');
    }
  };

  const handleUpdateCourseDetails = async (courseId: string) => {
    if (!editingCourseTitle.trim()) return;
    try {
      const { error } = await supabase.from('courses').update({
        title: editingCourseTitle,
        description: editingCourseDesc
      }).eq('id', courseId);

      if (error) throw error;
      showToast('✏️ Detalles del curso actualizados', 'success');
      setEditingCourseId(null);
      setEditingCourseTitle('');
      setEditingCourseDesc('');
      fetchCourses(pageCourses);
    } catch (err: any) {
      console.error(err);
      showToast(`Error al editar curso: ${err.message}`, 'error');
    }
  };

  const handleToggleCourseActive = async (courseId: string, currentActive: boolean) => {
    try {
      const { error } = await supabase.from('courses').update({ is_active: !currentActive }).eq('id', courseId);
      if (error) throw error;
      
      showToast(currentActive ? '⏸️ Curso pausado' : '▶️ Curso reactivado', 'success');
      fetchCourses(pageCourses);
    } catch (err: any) {
      console.error(err);
      showToast(`Error al actualizar estado del curso: ${err.message}`, 'error');
    }
  };

  // --- BONUSES ACTIONS ---
  const handleCreateBonus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bonusTitle.trim()) return;

    try {
      const { error } = await supabase.from('bonuses').insert({
        title: bonusTitle,
        description: bonusDesc,
        drive_url: bonusDriveUrl || '#',
        image_url: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?q=80&w=800',
        is_global: bonusIsGlobal,
        is_active: true
      });

      if (error) throw error;

      await supabase.from('notifications').insert({
        user_id: null,
        title: '🎁 ¡Nuevo Bono VIP!',
        message: `Hemos añadido un nuevo recurso a la bóveda: "${bonusTitle}". ¡Disfrútalo!`,
        is_read: false
      });

      showToast('🎁 ¡Bono publicado en el catálogo!', 'success');
      setBonusTitle(''); setBonusDesc(''); setBonusDriveUrl('');
      fetchBonuses(pageBonuses);
    } catch (err: any) {
      console.error(err);
      showToast(`Error al crear bono: ${err.message}`, 'error');
    }
  };

  const handleUpdateBonusDetails = async (bonusId: string) => {
    if (!editingBonusTitle.trim()) return;
    try {
      const { error } = await supabase.from('bonuses').update({
        title: editingBonusTitle,
        description: editingBonusDesc
      }).eq('id', bonusId);

      if (error) throw error;
      showToast('✏️ Detalles del bono actualizados', 'success');
      setEditingBonusId(null);
      setEditingBonusTitle('');
      setEditingBonusDesc('');
      fetchBonuses(pageBonuses);
    } catch (err: any) {
      console.error(err);
      showToast(`Error al editar bono: ${err.message}`, 'error');
    }
  };

  const handleToggleBonusActive = async (bonusId: string, currentActive: boolean) => {
    try {
      const { error } = await supabase.from('bonuses').update({ is_active: !currentActive }).eq('id', bonusId);
      if (error) throw error;
      
      showToast(currentActive ? '⏸️ Bono pausado' : '▶️ Bono reactivado', 'success');
      fetchBonuses(pageBonuses);
    } catch (err: any) {
      console.error(err);
      showToast(`Error al actualizar estado del bono: ${err.message}`, 'error');
    }
  };

  // --- CATEGORIES ACTIONS ---
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    setSavingCategory(true);
    
    try {
      const { error } = await supabase.from('course_categories').insert({ name: newCategoryName });
      if (error) throw error;
      
      showToast('Categoría añadida correctamente', 'success');
      setNewCategoryName('');
      fetchCategories();
    } catch (err: any) {
      console.error(err);
      showToast(`Error al crear categoría: ${err.message}`, 'error');
    } finally {
      setSavingCategory(false);
    }
  };

  const handleDeleteCategory = async (catId: string) => {
    if (!window.confirm('¿Eliminar esta categoría?')) return;
    try {
      const { error } = await supabase.from('course_categories').delete().eq('id', catId);
      if (error) throw error;
      showToast('Categoría eliminada', 'success');
      fetchCategories();
    } catch (err: any) {
      console.error(err);
      showToast(`Error al eliminar categoría: ${err.message}`, 'error');
    }
  };

  // --- RENDER PAGINATION ---
  const renderPagination = (currentPage: number, totalItems: number, setPage: (p: number) => void) => {
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
    if (totalPages <= 1) return null;

    return (
      <div className="flex items-center justify-center gap-1.5 mt-4">
        <button
          disabled={currentPage === 1}
          onClick={() => setPage(currentPage - 1)}
          className="px-3 py-1.5 rounded-xl text-[10px] font-extrabold uppercase border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 transition-colors shadow-sm cursor-pointer"
        >
          Anterior
        </button>
        <span className="text-[10px] font-extrabold text-gray-500 px-3 uppercase tracking-wider">
          {currentPage} / {totalPages}
        </span>
        <button
          disabled={currentPage === totalPages}
          onClick={() => setPage(currentPage + 1)}
          className="px-3 py-1.5 rounded-xl text-[10px] font-extrabold uppercase border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 transition-colors shadow-sm cursor-pointer"
        >
          Siguiente
        </button>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fade-in">
      
      {/* PANEL DE CURSOS */}
      <div className="flex flex-col gap-6">
        
        {/* Creador de Cursos */}
        <div className="bg-white/80 backdrop-blur-md rounded-3xl p-6 border border-white/80 shadow-sm flex flex-col gap-4">
          <h3 className="font-extrabold text-sm text-gray-900 flex items-center gap-2">
            <PlusCircle className="text-blue-600" size={18} />
            <span>Subir Nuevo Curso</span>
          </h3>
          
          <form onSubmit={handleCreateCourse} className="flex flex-col gap-3.5">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">Título del Curso</label>
              <input type="text" required value={courseTitle} onChange={e => setCourseTitle(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold" />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">Descripción</label>
              <textarea required rows={2} value={courseDesc} onChange={e => setCourseDesc(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">URL de Drive</label>
                <input type="url" required value={courseDriveUrl} onChange={e => setCourseDriveUrl(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">Categoría</label>
                <select value={courseCategory} onChange={e => setCourseCategory(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-3 text-xs font-semibold text-gray-700">
                  <option value="">General</option>
                  {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">URL Portada</label>
              <input type="url" value={courseImageUrl} onChange={e => setCourseImageUrl(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold" />
            </div>

            <button type="submit" className="w-full py-3 text-white rounded-xl text-xs font-bold shadow bg-blue-600 hover:bg-blue-700 cursor-pointer">
              Publicar Nuevo Curso
            </button>
          </form>
        </div>

        {/* Listado de Cursos */}
        <div className="flex flex-col gap-3">
          <h3 className="font-extrabold text-xs text-gray-400 uppercase tracking-wider px-1">Cursos Existentes (Edición)</h3>
          <div>
            <div className="flex flex-col gap-3">
              {courses.map(course => (
                <div key={course.id} className="bg-white/80 backdrop-blur-md rounded-3xl p-5 border border-white/80 shadow-sm flex flex-col gap-3">
                  {editingCourseId === course.id ? (
                    <div className="flex flex-col gap-3">
                      <input type="text" value={editingCourseTitle} onChange={e => setEditingCourseTitle(e.target.value)} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold" />
                      <textarea rows={3} value={editingCourseDesc} onChange={e => setEditingCourseDesc(e.target.value)} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold" />
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => handleUpdateCourseDetails(course.id)} className="bg-green-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer">Guardar</button>
                        <button onClick={() => { setEditingCourseId(null); setEditingCourseTitle(''); setEditingCourseDesc(''); }} className="bg-gray-150 text-gray-700 text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer">Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex justify-between items-start">
                        <h4 className="font-extrabold text-sm text-gray-900">{course.title}</h4>
                        <button onClick={() => {
                          setEditingCourseId(course.id);
                          setEditingCourseTitle(course.title);
                          setEditingCourseDesc(course.description || '');
                        }} className="text-gray-455 hover:text-blue-600 p-1.5 rounded-lg cursor-pointer">
                          <FileEdit size={16} />
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed">{course.description || 'Sin descripción'}</p>
                      <div className="flex justify-between items-center border-t border-gray-55 pt-3 mt-3">
                        <span className={`text-[9px] font-extrabold uppercase ${course.is_active ? 'text-green-600' : 'text-red-500'}`}>
                          {course.is_active ? 'Activo en Academia' : 'Pausado'}
                        </span>
                        <button onClick={() => handleToggleCourseActive(course.id, course.is_active)} className={`text-[10px] font-bold px-3 py-1 rounded-lg border cursor-pointer ${course.is_active ? 'border-red-250 text-red-500 hover:bg-red-50' : 'border-green-200 text-green-600 hover:bg-green-50'}`}>
                          {course.is_active ? 'Pausar' : 'Activar'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {renderPagination(pageCourses, coursesCount, setPageCourses)}
          </div>
        </div>

        {/* Categorías */}
        <div className="bg-white/80 backdrop-blur-md rounded-3xl p-6 border border-white/80 shadow-sm flex flex-col gap-4">
          <h3 className="font-extrabold text-sm text-gray-900 flex items-center gap-2">
            <Sparkles className="text-indigo-600" size={18} />
            <span>Gestión de Categorías</span>
          </h3>
          <form onSubmit={handleCreateCategory} className="flex gap-2">
            <input type="text" required value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} className="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold" />
            <button type="submit" disabled={savingCategory} className="bg-indigo-650 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center shrink-0 cursor-pointer">
              {savingCategory ? <Loader2 className="animate-spin w-4 h-4" /> : 'Añadir'}
            </button>
          </form>
          <div className="flex flex-wrap gap-2 mt-1">
            {categories.map(cat => (
              <span key={cat.id} className="flex items-center gap-1.5 bg-gray-100 border border-gray-200 text-gray-700 text-xs font-semibold px-3 py-1.5 rounded-xl">
                {cat.name}
                <button type="button" onClick={() => handleDeleteCategory(cat.id)} className="text-red-500 cursor-pointer"><X size={12} /></button>
              </span>
            ))}
          </div>
        </div>

      </div>

      {/* PANEL DE BONOS */}
      <div className="flex flex-col gap-6">
        
        {/* Creador de Bonos */}
        <div className="bg-white/80 backdrop-blur-md rounded-3xl p-6 border border-white/80 shadow-sm flex flex-col gap-4">
          <h3 className="font-extrabold text-sm text-gray-950 flex items-center gap-2">
            <PlusCircle className="text-purple-600" size={18} />
            <span>Subir Nuevo Bono</span>
          </h3>
          <form onSubmit={handleCreateBonus} className="flex flex-col gap-3.5">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">Título del Bono</label>
              <input type="text" required value={bonusTitle} onChange={e => setBonusTitle(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold" />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">Descripción</label>
              <textarea required rows={2} value={bonusDesc} onChange={e => setBonusDesc(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">Enlace Drive</label>
                <input type="url" value={bonusDriveUrl} onChange={e => setBonusDriveUrl(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">Público</label>
                <select value={bonusIsGlobal ? 'true' : 'false'} onChange={e => setBonusIsGlobal(e.target.value === 'true')} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-3 text-xs font-semibold">
                  <option value="true">Global</option>
                  <option value="false">Privado</option>
                </select>
              </div>
            </div>

            <button type="submit" className="w-full py-3 text-white rounded-xl text-xs font-bold shadow bg-purple-600 hover:bg-purple-700 cursor-pointer">
              Publicar Nuevo Bono
            </button>
          </form>
        </div>

        {/* Listado de Bonos */}
        <div className="flex flex-col gap-3">
          <h3 className="font-extrabold text-xs text-gray-400 uppercase tracking-wider px-1">Bonos Existentes</h3>
          <div>
            <div className="flex flex-col gap-3">
              {bonuses.map(bonus => (
                <div key={bonus.id} className="bg-white/80 backdrop-blur-md rounded-3xl p-5 border border-white/80 shadow-sm flex flex-col gap-3">
                  {editingBonusId === bonus.id ? (
                    <div className="flex flex-col gap-3">
                      <input type="text" value={editingBonusTitle} onChange={e => setEditingBonusTitle(e.target.value)} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold" />
                      <textarea rows={3} value={editingBonusDesc} onChange={e => setEditingBonusDesc(e.target.value)} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold" />
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => handleUpdateBonusDetails(bonus.id)} className="bg-green-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer">Guardar</button>
                        <button onClick={() => { setEditingBonusId(null); setEditingBonusTitle(''); setEditingBonusDesc(''); }} className="bg-gray-150 text-gray-700 text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer">Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-extrabold text-sm text-gray-900">{bonus.title}</h4>
                          <span className={`text-[8px] font-extrabold uppercase px-2 py-0.5 rounded-full inline-block mt-1 ${bonus.is_global ? 'bg-blue-50 text-blue-600' : 'bg-indigo-50 text-indigo-600'}`}>
                            {bonus.is_global ? 'Global' : 'Privado'}
                          </span>
                        </div>
                        <button onClick={() => {
                          setEditingBonusId(bonus.id);
                          setEditingBonusTitle(bonus.title);
                          setEditingBonusDesc(bonus.description || '');
                        }} className="text-gray-455 hover:text-blue-600 p-1.5 rounded-lg cursor-pointer">
                          <FileEdit size={16} />
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mt-2 leading-relaxed">{bonus.description}</p>
                      <div className="flex justify-between items-center border-t border-gray-55 pt-3 mt-3">
                        <span className={`text-[9px] font-extrabold uppercase ${bonus.is_active ? 'text-green-600' : 'text-red-500'}`}>
                          {bonus.is_active ? 'Activo' : 'Pausado'}
                        </span>
                        <button onClick={() => handleToggleBonusActive(bonus.id, bonus.is_active)} className={`text-[10px] font-bold px-3 py-1 rounded-lg border cursor-pointer ${bonus.is_active ? 'border-red-250 text-red-500 hover:bg-red-50' : 'border-green-200 text-green-600 hover:bg-green-50'}`}>
                          {bonus.is_active ? 'Pausar' : 'Activar'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {renderPagination(pageBonuses, bonusesCount, setPageBonuses)}
          </div>
        </div>

      </div>
    </div>
  );
}
