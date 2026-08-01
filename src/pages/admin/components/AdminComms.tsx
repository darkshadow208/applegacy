import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { AlertCircle, PlusCircle, Loader2 } from 'lucide-react';

interface AdminCommsProps {
  showToast: (text: string, type?: 'success' | 'error' | 'info') => void;
}

export function AdminComms({ showToast }: AdminCommsProps) {
  // Announcements
  const [announcementText, setAnnouncementText] = useState('');
  const [savingAnnouncement, setSavingAnnouncement] = useState(false);
  const [announcementsList, setAnnouncementsList] = useState<any[]>([]);

  // Blog
  const [blogTitle, setBlogTitle] = useState('');
  const [blogContent, setBlogContent] = useState('');
  const [blogImageUrl, setBlogImageUrl] = useState('');
  const [savingBlog, setSavingBlog] = useState(false);

  const fetchAnnouncements = async () => {
    try {
      const { data, error } = await supabase.from('news_posts').select('*').eq('type', 'announcement').order('created_at', { ascending: false });
      if (error) throw error;
      setAnnouncementsList(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!announcementText.trim()) return;
    setSavingAnnouncement(true);
    try {
      const { error } = await supabase.from('news_posts').insert({
        title: 'Aviso Global',
        content: announcementText,
        type: 'announcement',
        is_active: true
      });
      if (error) throw error;

      await supabase.from('notifications').insert({
        user_id: null,
        title: '⚠️ Nuevo Aviso Global',
        message: announcementText.length > 50 ? announcementText.substring(0, 47) + '...' : announcementText,
        is_read: false
      });

      showToast('Aviso Global Publicado', 'success');
      setAnnouncementText('');
      fetchAnnouncements();
    } catch (err: any) {
      console.error(err);
      showToast('Error al publicar aviso', 'error');
    } finally {
      setSavingAnnouncement(false);
    }
  };

  const handleRemoveAnnouncement = async (annId: string) => {
    try {
      const { error } = await supabase.from('news_posts').delete().eq('id', annId);
      if (error) throw error;
      showToast('Aviso eliminado', 'success');
      fetchAnnouncements();
    } catch (err) {
      console.error(err);
      showToast('Error al eliminar aviso', 'error');
    }
  };

  const handleCreateBlogPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blogTitle.trim() || !blogContent.trim()) return;
    setSavingBlog(true);
    
    try {
      const { error } = await supabase.from('news_posts').insert({
        title: blogTitle,
        content: blogContent,
        image_url: blogImageUrl || 'https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=800',
        type: 'blog',
        is_active: true
      });
      if (error) throw error;

      await supabase.from('notifications').insert({
        user_id: null,
        title: '📝 Nuevo artículo en el Blog',
        message: `Acabamos de publicar: "${blogTitle}". ¡Ve a leerlo!`,
        is_read: false
      });

      showToast('Artículo de Blog Publicado', 'success');
      setBlogTitle('');
      setBlogContent('');
      setBlogImageUrl('');
    } catch (err: any) {
      console.error(err);
      showToast('Error al publicar en blog', 'error');
    } finally {
      setSavingBlog(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fade-in">
      
      {/* Formulario de Anuncio de Inicio */}
      <div className="bg-white/80 backdrop-blur-md rounded-3xl p-6 border border-white/80 shadow-sm flex flex-col gap-4 h-max">
        <h3 className="font-extrabold text-sm text-gray-900 flex items-center gap-2">
          <AlertCircle className="text-yellow-600" size={18} />
          <span>Aviso de Inicio (Estudiantes)</span>
        </h3>
        <p className="text-[11px] text-gray-500">Este mensaje aparecerá destacado en color amarillo en la cabecera de la pantalla de inicio de todos los alumnos activos.</p>
        
        <form onSubmit={handleCreateAnnouncement} className="flex flex-col gap-4 mb-6">
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">Nuevo Mensaje de Alerta</label>
            <textarea 
              required
              value={announcementText}
              onChange={e => setAnnouncementText(e.target.value)}
              placeholder="Ej: Este miércoles tendremos mentoría privada a las 8:00 PM..."
              rows={3}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={savingAnnouncement}
            className="w-full py-3.5 bg-yellow-600 hover:bg-yellow-700 text-white rounded-xl text-xs font-bold shadow flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {savingAnnouncement ? <Loader2 className="animate-spin" size={16} /> : 'Publicar Nuevo Aviso'}
          </button>
        </form>

        {/* Listado de avisos activos */}
        <div className="flex flex-col gap-3">
          <h4 className="text-xs font-extrabold text-gray-950">Avisos Activos Actualmente ({announcementsList.length})</h4>
          {announcementsList.length === 0 ? (
            <p className="text-[11px] text-gray-500 italic bg-gray-50/50 p-4 rounded-2xl text-center">No hay avisos activos en la academia.</p>
          ) : (
            <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
              {announcementsList.map((ann) => (
                <div key={ann.id} className="bg-yellow-50/50 border border-yellow-200/50 rounded-2xl p-3.5 flex justify-between items-start gap-3">
                  <div className="flex-1">
                    <p className="text-[11px] font-bold text-yellow-800 whitespace-pre-wrap leading-relaxed">{ann.content}</p>
                    <span className="text-[9px] text-gray-400 block mt-1">{new Date(ann.created_at).toLocaleDateString()}</span>
                  </div>
                  <button
                    onClick={() => handleRemoveAnnouncement(ann.id)}
                    type="button"
                    className="bg-red-50 hover:bg-red-100 text-red-600 p-1.5 rounded-xl transition-colors cursor-pointer shrink-0"
                    title="Remover aviso"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Formulario Creador de Blog */}
      <div className="bg-white/80 backdrop-blur-md rounded-3xl p-6 border border-white/80 shadow-sm flex flex-col gap-4">
        <h3 className="font-extrabold text-sm text-gray-950 flex items-center gap-2">
          <PlusCircle className="text-pink-600" size={18} />
          <span>Crear Entrada para el Blog</span>
        </h3>
        
        <form onSubmit={handleCreateBlogPost} className="flex flex-col gap-4">
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">Título del Post</label>
            <input 
              type="text" 
              required
              value={blogTitle}
              onChange={e => setBlogTitle(e.target.value)}
              placeholder="Ej: 5 Consejos para duplicar conversiones"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">Contenido del Artículo</label>
            <textarea 
              required
              value={blogContent}
              onChange={e => setBlogContent(e.target.value)}
              placeholder="Escribe el cuerpo del artículo..."
              rows={6}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">URL de Imagen Ilustrativa</label>
            <input 
              type="url" 
              value={blogImageUrl}
              onChange={e => setBlogImageUrl(e.target.value)}
              placeholder="https://images.unsplash.com/..."
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={savingBlog}
            className="w-full py-3.5 bg-pink-600 hover:bg-pink-700 text-white rounded-xl text-xs font-bold shadow flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {savingBlog ? <Loader2 className="animate-spin" size={16} /> : 'Publicar en el Blog'}
          </button>
        </form>
      </div>

    </div>
  );
}
