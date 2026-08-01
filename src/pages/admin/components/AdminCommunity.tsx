import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { Globe, Plus, Trash2, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

interface AdminCommunityProps {
  showToast: (text: string, type?: 'success' | 'error' | 'info') => void;
}

const ITEMS_PER_PAGE = 5;

export function AdminCommunity({ showToast }: AdminCommunityProps) {
  // --- STATES ---
  const [approvedContributions, setApprovedContributions] = useState<any[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // --- FETCH ---
  const fetchApprovedContributions = async (pageNumber: number) => {
    setLoading(true);
    try {
      const { data, count, error } = await supabase
        .from('user_contributions')
        .select(`*, users_profiles(email, full_name)`, { count: 'exact' })
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .range((pageNumber - 1) * ITEMS_PER_PAGE, pageNumber * ITEMS_PER_PAGE - 1);
      
      if (error) throw error;
      setApprovedContributions(data || []);
      setCount(count || 0);
    } catch (err) {
      console.error(err);
      showToast('Error cargando la comunidad', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovedContributions(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // --- ACTIONS ---
  const handleDeleteContribution = async (contId: string) => {
    if (!window.confirm('¿Seguro que quieres eliminar este aporte permanentemente?')) return;
    try {
      const { error } = await supabase.from('user_contributions').delete().eq('id', contId);
      if (error) throw error;

      showToast('Aporte eliminado permanentemente.', 'success');
      fetchApprovedContributions(page);
    } catch (err) {
      console.error(err);
      showToast('Error al eliminar el aporte.', 'error');
    }
  };

  // --- RENDER PAGINATION ---
  const renderPagination = () => {
    const totalPages = Math.ceil(count / ITEMS_PER_PAGE);
    if (totalPages <= 1) return null;

    return (
      <div className="flex items-center justify-center gap-1.5 mt-4">
        <button
          disabled={page === 1}
          onClick={() => setPage(page - 1)}
          className="px-3 py-1.5 rounded-xl text-[10px] font-extrabold uppercase border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 transition-colors shadow-sm cursor-pointer"
        >
          Anterior
        </button>
        <span className="text-[10px] font-extrabold text-gray-500 px-3 uppercase tracking-wider">
          {page} / {totalPages}
        </span>
        <button
          disabled={page === totalPages}
          onClick={() => setPage(page + 1)}
          className="px-3 py-1.5 rounded-xl text-[10px] font-extrabold uppercase border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 transition-colors shadow-sm cursor-pointer"
        >
          Siguiente
        </button>
      </div>
    );
  };

  if (loading && approvedContributions.length === 0) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 sm:gap-0">
        <div>
          <h3 className="font-extrabold text-xs text-gray-400 uppercase tracking-wider px-1">Comunidad Activa</h3>
          <p className="text-[10px] text-gray-500 mt-1 px-1">Aportes que ya están visibles para los estudiantes.</p>
        </div>
        <Link to="/contribute" className="w-full sm:w-auto justify-center bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-extrabold px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-sm transition-colors uppercase tracking-wider">
          <Plus size={14} /> Añadir Aporte
        </Link>
      </div>

      {approvedContributions.length > 0 ? (
        <div>
          <div className="flex flex-col gap-3">
            {approvedContributions.map(cont => (
              <div key={cont.id} className="bg-white/85 backdrop-blur-md rounded-3xl p-5 border border-white/80 shadow-sm flex flex-col gap-4">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <span className="text-[9px] font-extrabold uppercase text-indigo-600 tracking-wider bg-indigo-50 px-2 py-0.5 rounded mr-2">
                      {cont.contribution_type === 'tip' ? '💡 Tip' : cont.contribution_type === 'book' ? '📘 Libro' : '🔗 Enlace'}
                    </span>
                    <span className="text-[9px] font-extrabold uppercase text-gray-500 tracking-wider bg-gray-100 px-2 py-0.5 rounded">
                      {cont.category || 'General'}
                    </span>
                    <h4 className="font-extrabold text-sm text-gray-900 mt-2">{cont.title}</h4>
                    <p className="text-[10px] text-gray-400 mt-1">Por: {cont.users_profiles?.full_name || cont.users_profiles?.email}</p>
                  </div>
                </div>
                
                <div className="bg-gray-50/50 p-4 rounded-2xl border border-gray-150 text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">
                  {cont.description}
                  {cont.link_url && (
                    <a href={cont.link_url} target="_blank" rel="noreferrer" className="text-indigo-600 font-bold hover:underline block mt-2">🔗 Ver Archivo/Link</a>
                  )}
                </div>
                
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => handleDeleteContribution(cont.id)}
                    className="bg-red-50 text-red-600 text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-red-100 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 size={14} /> Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
          {renderPagination()}
        </div>
      ) : (
        <div className="text-center py-10 bg-white/60 backdrop-blur-md rounded-3xl border border-dashed border-gray-250 flex flex-col items-center justify-center gap-2">
          <div className="w-10 h-10 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center"><Globe size={18} /></div>
          <p className="text-gray-800 text-xs font-extrabold">Aún no hay aportes aprobados en la comunidad.</p>
        </div>
      )}
    </div>
  );
}
