import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { ExternalLink, Link as LinkIcon, BookOpen, Lightbulb, ThumbsUp, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Community() {
  const [contributions, setContributions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchContributions() {
      // Promesa de timeout para evitar quedarse cargando infinitamente si hay un problema de red
      const timeoutPromise = new Promise((resolve) => {
        setTimeout(() => resolve({ data: [], error: null }), 5000);
      });

      try {
        const queryPromise = supabase
          .from('user_contributions')
          .select(`
            *,
            users_profiles (full_name, avatar_url)
          `)
          .eq('status', 'approved')
          .order('created_at', { ascending: false });

        // Competencia de promesas
        const { data, error } = await Promise.race([queryPromise, timeoutPromise]) as any;

        if (error) throw error;
        
        if (data) {
          setContributions(data);
        }
      } catch (err) {
        console.error('Error fetching contributions:', err);
        setContributions([]);
      } finally {
        setLoading(false);
      }
    }
    fetchContributions();
  }, []);

  const getIcon = (type: string) => {
    switch(type) {
      case 'book': return <BookOpen size={16} />;
      case 'tip': return <Lightbulb size={16} />;
      default: return <LinkIcon size={16} />;
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in pb-20">
      
      <div className="flex flex-col gap-1">
        <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Comunidad</h2>
        <p className="text-gray-500 text-sm">Aportes y recursos de otros estudiantes.</p>
      </div>

      <Link 
        to="/contribute" 
        className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl p-4 flex items-center justify-between shadow-lg shadow-blue-500/20 hover:scale-[1.02] transition-transform"
      >
        <div>
          <h4 className="font-bold">¿Tienes algo que compartir?</h4>
          <p className="text-blue-100 text-xs mt-1">Envía un recurso y ayuda a otros</p>
        </div>
        <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
          <ThumbsUp size={20} />
        </div>
      </Link>

      <div className="flex flex-col gap-4 mt-2">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-blue-500" /></div>
        ) : contributions.length === 0 ? (
          <div className="text-center py-10 bg-white/60 backdrop-blur-md rounded-3xl border border-white/80">
            <p className="text-gray-500">Aún no hay aportes de la comunidad.</p>
          </div>
        ) : (
          contributions.map((item) => (
            <div key={item.id} className="bg-white/80 backdrop-blur-md rounded-3xl p-5 shadow-sm border border-white/80 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden">
                  {item.users_profiles?.avatar_url ? (
                    <img src={item.users_profiles.avatar_url} alt="User" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-tr from-gray-400 to-gray-600 flex items-center justify-center text-white text-xs font-bold">
                      {item.users_profiles?.full_name?.charAt(0) || 'U'}
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">{item.users_profiles?.full_name || 'Usuario'}</p>
                  <p className="text-[10px] text-gray-400">{new Date(item.created_at).toLocaleDateString()}</p>
                </div>
                <div className="ml-auto bg-gray-100 text-gray-600 px-2 py-1 rounded-md flex items-center gap-1 text-[10px] font-bold uppercase">
                  {getIcon(item.contribution_type)}
                  <span>{item.contribution_type}</span>
                </div>
              </div>
              
              <div>
                <h4 className="font-bold text-gray-900 leading-tight">{item.title}</h4>
                {item.description && <p className="text-sm text-gray-600 mt-1 line-clamp-3">{item.description}</p>}
              </div>

              {item.link_url && (
                <a 
                  href={item.link_url} 
                  target="_blank" 
                  rel="noreferrer"
                  className="mt-2 flex items-center justify-center gap-2 py-2 px-4 bg-blue-50 text-blue-600 rounded-xl text-sm font-semibold hover:bg-blue-100 transition-colors"
                >
                  <ExternalLink size={16} />
                  Ver recurso
                </a>
              )}
            </div>
          ))
        )}
      </div>

    </div>
  );
}
