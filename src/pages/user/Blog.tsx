import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { BookOpen, Calendar, Clock, ArrowLeft } from 'lucide-react';

interface BlogPost {
  id: string;
  title: string;
  content: string;
  image_url: string;
  created_at: string;
  is_active: boolean;
}

export function Blog() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);

  const fetchBlogPosts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('news_posts')
        .select('*')
        .eq('type', 'blog')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setPosts(data);
    } catch (err) {
      console.error('Error fetching blog posts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBlogPosts();
  }, []);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const estimateReadingTime = (content: string) => {
    const wordsPerMinute = 200;
    const words = content.split(/\s+/).length;
    const minutes = Math.ceil(words / wordsPerMinute);
    return `${minutes} min de lectura`;
  };

  if (selectedPost) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6 animate-fade-in">
        <button
          onClick={() => setSelectedPost(null)}
          className="flex items-center gap-2 text-xs font-extrabold uppercase text-gray-500 hover:text-gray-900 transition-colors mb-6 cursor-pointer"
        >
          <ArrowLeft size={16} />
          <span>Volver al Blog</span>
        </button>

        <article className="flex flex-col gap-6">
          {/* Imagen obligatoriamente arriba, limpia y sin overlays */}
          <div className="w-full h-64 sm:h-96 rounded-3xl overflow-hidden bg-gray-150 border border-gray-100 shadow-sm">
            <img
              src={selectedPost.image_url || 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?q=80&w=800'}
              alt={selectedPost.title}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Todo el texto abajo, sin estilo de tarjeta (card) */}
          <div className="flex flex-col gap-4">
            <h1 className="text-2xl sm:text-4xl font-black text-gray-950 leading-tight tracking-tight">
              {selectedPost.title}
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-xs font-extrabold text-gray-400 border-b border-gray-100 pb-4">
              <span className="flex items-center gap-1.5">
                <Calendar size={14} />
                {formatDate(selectedPost.created_at)}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock size={14} />
                {estimateReadingTime(selectedPost.content)}
              </span>
            </div>

            <div className="text-gray-800 text-sm sm:text-base leading-relaxed whitespace-pre-wrap font-medium mt-2">
              {selectedPost.content}
            </div>
          </div>
        </article>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto animate-fade-in pb-16">
      
      {/* Cabecera Editorial */}
      <div className="text-center py-6">
        <span className="text-[10px] font-black uppercase text-indigo-650 tracking-widest bg-indigo-50 px-3 py-1 rounded-full">
          Novedades de la Academia
        </span>
        <h2 className="text-2xl sm:text-3xl font-black text-gray-955 mt-3 tracking-tight">
          Blog y Actualizaciones
        </h2>
        <p className="text-xs sm:text-sm text-gray-500 mt-2 max-w-md mx-auto">
          Estrategias de conversión, lanzamientos y anuncios oficiales de Legacy Academy.
        </p>
      </div>

      {loading ? (
        // Loading Skeleton
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {[1, 2, 3].map((n) => (
            <div key={n} className="flex flex-col gap-4 animate-pulse">
              <div className="h-48 bg-gray-200 rounded-2xl w-full" />
              <div className="h-4 bg-gray-200 rounded-lg w-1/3" />
              <div className="h-6 bg-gray-200 rounded-lg w-full" />
              <div className="h-4 bg-gray-200 rounded-lg w-5/6" />
            </div>
          ))}
        </div>
      ) : posts.length > 0 ? (
        // Blog Editorial Grid (Imagen arriba, texto abajo, sin contenedores tipo tarjeta)
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {posts.map((post) => (
            <article
              key={post.id}
              onClick={() => setSelectedPost(post)}
              className="flex flex-col gap-4 cursor-pointer group"
            >
              {/* Imagen arriba */}
              <div className="h-48 w-full bg-gray-50 rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
                <img
                  src={post.image_url || 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?q=80&w=800'}
                  alt={post.title}
                  className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-500"
                />
              </div>

              {/* Texto abajo */}
              <div className="flex flex-col gap-2 px-1">
                <div className="flex items-center gap-1.5 text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">
                  <Calendar size={12} />
                  <span>{formatDate(post.created_at)}</span>
                  <span>•</span>
                  <span>{estimateReadingTime(post.content)}</span>
                </div>
                <h3 className="font-extrabold text-base text-gray-950 group-hover:text-indigo-650 transition-colors line-clamp-2 leading-snug">
                  {post.title}
                </h3>
                <p className="text-xs text-gray-500 line-clamp-3 leading-relaxed font-medium">
                  {post.content}
                </p>
                <span className="text-[10px] font-extrabold uppercase text-indigo-650 tracking-wider mt-1 block">
                  Leer artículo →
                </span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        // Empty State
        <div className="text-center py-16 bg-white/60 backdrop-blur-md rounded-3xl border border-dashed border-gray-250 flex flex-col items-center justify-center gap-3">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center">
            <BookOpen size={22} />
          </div>
          <h4 className="text-gray-900 text-sm font-extrabold">Aún no hay artículos publicados</h4>
          <p className="text-gray-500 text-xs max-w-xs mx-auto">
            El administrador publicará contenido muy pronto. Vuelve más tarde para leer las novedades.
          </p>
        </div>
      )}
    </div>
  );
}
