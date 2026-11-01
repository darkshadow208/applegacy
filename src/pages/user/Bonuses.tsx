import { useEffect, useState } from 'react';
import { Star, Download, Loader2 } from 'lucide-react';
import { errorMessage } from '../../lib/errors';
import { supabase } from '../../lib/supabase';

export function Bonuses() {
  const [bonuses, setBonuses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [loadError, setLoadError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    localStorage.removeItem('cached_bonuses');
    async function fetchBonuses() {
      try {
        const { data } = await supabase.from('bonuses').select('id, title, description, image_url, drive_url')
          .eq('is_active', true).order('created_at', { ascending: false }).throwOnError();
        if (active) setBonuses((data || []).map(item => ({ ...item,
          image: item.image_url || 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?q=80&w=400',
          url: item.drive_url || '#'
        })));
      } catch (error) { if (active) { setBonuses([]); setLoadError(errorMessage(error)); } }
      finally { if (active) setLoading(false); }
    }
    void fetchBonuses();
    return () => { active = false; };
  }, []);

  return (
    <div className="flex flex-col gap-6 animate-fade-in pb-20">
      
      {loadError && <p role="alert" className="text-red-700">{loadError}</p>}
      {!loading && !loadError && bonuses.length === 0 && <p>No tienes bonos disponibles con tu membresía actual.</p>}
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Mis Bonos</h2>
        <p className="text-gray-500 text-sm">Recursos exclusivos por tu membresía.</p>
      </div>

      {loading && bonuses.length === 0 ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-purple-600 w-8 h-8" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5">
          {bonuses.map(bonus => (
            <div key={bonus.id} className="bg-white/60 backdrop-blur-md rounded-[2rem] p-4 shadow-sm border border-white/80 flex flex-col gap-4">
              <div className="h-32 w-full rounded-2xl overflow-hidden relative">
                <img src={bonus.image} alt={bonus.title} className="w-full h-full object-cover" />
                <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-md text-purple-600 rounded-full p-2 shadow-sm">
                  <Star size={16} fill="currentColor" />
                </div>
              </div>
              
              <div className="px-1">
                <h3 className="font-bold text-lg text-gray-900 leading-tight">{bonus.title}</h3>
                <p className="text-gray-500 text-sm mt-1 mb-4 leading-relaxed">{bonus.description}</p>
                
                <a 
                  href={bonus.url}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full bg-gradient-to-r from-gray-900 to-gray-800 text-white rounded-xl py-3 flex items-center justify-center gap-2 font-semibold shadow-sm hover:scale-[1.02] transition-transform"
                >
                  <Download size={18} />
                  Descargar Recurso
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
