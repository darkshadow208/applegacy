import { Outlet, useNavigate } from 'react-router-dom';
import { Shield, ArrowLeft } from 'lucide-react';

export function AdminLayout() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-tr from-gray-50 via-slate-100 to-zinc-200 flex flex-col font-sans">
      
      {/* Premium Top Bar */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200/80 sticky top-0 z-40 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-yellow-500 to-amber-500 flex items-center justify-center text-white shadow-sm">
            <Shield size={20} />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-gray-900 tracking-tight leading-none">Poder Absoluto</h2>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-1">Consola de Control • Admin</p>
          </div>
        </div>

        <button 
          onClick={() => navigate('/profile')}
          className="flex items-center gap-2 px-4 py-2 bg-gray-950 text-white rounded-xl text-xs font-bold shadow hover:bg-black transition-all"
        >
          <ArrowLeft size={14} />
          <span>Volver a la Academia</span>
        </button>
      </header>

      {/* Main Administrative Screen Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 md:p-6">
        <Outlet />
      </main>

    </div>
  );
}
