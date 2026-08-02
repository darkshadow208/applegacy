import { useEffect, useState } from 'react';
import { Star, Download, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const mockBonuses = [
  {
    id: '1',
    title: 'Plantilla de Presupuesto Mensual',
    description: 'Un excel automatizado para controlar tus finanzas. Úsalo mes a mes para llevar un registro claro de tus ingresos y gastos.',
    image: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?q=80&w=400&auto=format&fit=crop',
    url: 'https://drive.google.com/file/d/ejemplo'
  },
  {
    id: '2',
    title: 'Lista de Herramientas AI',
    description: 'Más de 50 herramientas de inteligencia artificial para ahorrar tiempo en diseño, copy y programación.',
    image: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?q=80&w=400&auto=format&fit=crop',
    url: 'https://drive.google.com/file/d/ejemplo2'
  }
];

export function Bonuses() {
  const [bonuses, setBonuses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Cargar caché inmediatamente para UI Optimista
    const cached = localStorage.getItem('cached_bonuses');
    if (cached) {
      try {
        setBonuses(JSON.parse(cached));
        setLoading(false);
      } catch (err) {
        console.warn('Error al parsear bonos en caché:', err);
      }
    }

    async function fetchBonuses() {
      // Timeout de seguridad de 4 segundos
      const timeoutPromise = new Promise((resolve) => {
        setTimeout(() => resolve({ data: null, error: new Error('Timeout') }), 4000);
      });

      try {
        const queryPromise = supabase
          .from('bonuses')
          .select('*')
          .eq('is_active', true)
          .eq('is_global', true)
          .order('created_at', { ascending: false });

        const { data, error } = await Promise.race([queryPromise, timeoutPromise]) as any;

        if (!error && data && data.length > 0) {
          const mapped = data.map((item: any) => ({
            id: item.id,
            title: item.title,
            description: item.description,
            image: item.image_url || 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?q=80&w=400&auto=format&fit=crop',
            url: item.drive_url || '#'
          }));
          setBonuses(mapped);
          localStorage.setItem('cached_bonuses', JSON.stringify(mapped));
        } else if (!cached) {
          setBonuses(mockBonuses);
          localStorage.setItem('cached_bonuses', JSON.stringify(mockBonuses));
        }
      } catch (err) {
        if (!cached) {
          setBonuses(mockBonuses);
          localStorage.setItem('cached_bonuses', JSON.stringify(mockBonuses));
        }
      } finally {
        setLoading(false);
      }
    }
    fetchBonuses();
  }, []);

  return (
    <div className="flex flex-col gap-6 animate-fade-in pb-20">
      
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
