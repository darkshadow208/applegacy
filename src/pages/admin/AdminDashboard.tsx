import { useState } from 'react';
import { 
  Users, 
  BookOpen,
  FileText,
  LineChart as ChartIcon,
  Globe,
  ShieldAlert
} from 'lucide-react';
import { AdminAnalytics } from './AdminAnalytics';
import { AdminApprovals } from './components/AdminApprovals';
import { AdminUsers } from './components/AdminUsers';
import { AdminContent } from './components/AdminContent';
import { AdminComms } from './components/AdminComms';
import { AdminCommunity } from './components/AdminCommunity';

export function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'approvals' | 'students' | 'content' | 'comms' | 'analytics' | 'community'>('approvals');

  // --- CUSTOM PREMIUM TOAST NOTIFICATION SYSTEM ---
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 5000);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-8 relative animate-fade-in">
      
      {/* ALERTA FLOTANTE PREMIUM (Toast) */}
      {toastMessage && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] animate-bounce-short">
          <div className={`
            px-6 py-4 rounded-2xl shadow-2xl backdrop-blur-md border flex items-center gap-3
            ${toastMessage.type === 'success' ? 'bg-green-900/95 border-green-500 text-green-50' : ''}
            ${toastMessage.type === 'error' ? 'bg-red-900/95 border-red-500 text-red-50' : ''}
            ${toastMessage.type === 'info' ? 'bg-blue-900/95 border-blue-500 text-blue-50' : ''}
          `}>
            {toastMessage.type === 'success' && <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />}
            {toastMessage.type === 'error' && <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />}
            {toastMessage.type === 'info' && <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />}
            <span className="font-extrabold tracking-wide text-sm">{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* Título Principal */}
      <div className="mb-8">
        <h1 className="text-3xl font-black text-gray-950 flex items-center gap-3 tracking-tight">
          Panel de Control VIP <span className="bg-gradient-to-r from-indigo-500 to-purple-600 text-transparent bg-clip-text">Academia</span>
        </h1>
        <p className="text-gray-500 font-semibold text-sm mt-1">Gestión avanzada, moderación y analíticas en tiempo real.</p>
      </div>

      {/* Tabs Modernos (Scrollable en móviles) */}
      <div className="flex gap-2 overflow-x-auto pb-4 mb-6 hide-scrollbar" style={{ scrollbarWidth: 'none' }}>
        <button
          onClick={() => setActiveTab('approvals')}
          className={`px-4 py-3 rounded-xl flex items-center justify-center gap-2 text-xs font-extrabold uppercase tracking-wide shrink-0 transition-all cursor-pointer ${
            activeTab === 'approvals' ? 'bg-gray-950 text-white shadow-md' : 'text-gray-500 hover:bg-white/40'
          }`}
        >
          <ShieldAlert size={16} className={activeTab === 'approvals' ? 'text-yellow-400' : ''} />
          <span>Aprobaciones</span>
        </button>

        <button
          onClick={() => setActiveTab('students')}
          className={`px-4 py-3 rounded-xl flex items-center justify-center gap-2 text-xs font-extrabold uppercase tracking-wide shrink-0 transition-all cursor-pointer ${
            activeTab === 'students' ? 'bg-gray-950 text-white shadow-md' : 'text-gray-500 hover:bg-white/40'
          }`}
        >
          <Users size={16} />
          <span>Alumnos & Suscripción</span>
        </button>

        <button
          onClick={() => setActiveTab('content')}
          className={`px-4 py-3 rounded-xl flex items-center justify-center gap-2 text-xs font-extrabold uppercase tracking-wide shrink-0 transition-all cursor-pointer ${
            activeTab === 'content' ? 'bg-gray-950 text-white shadow-md' : 'text-gray-500 hover:bg-white/40'
          }`}
        >
          <BookOpen size={16} />
          <span>Cursos & Bonos</span>
        </button>

        <button
          onClick={() => setActiveTab('comms')}
          className={`px-4 py-3 rounded-xl flex items-center justify-center gap-2 text-xs font-extrabold uppercase tracking-wide shrink-0 transition-all cursor-pointer ${
            activeTab === 'comms' ? 'bg-gray-950 text-white shadow-md' : 'text-gray-500 hover:bg-white/40'
          }`}
        >
          <FileText size={16} />
          <span>Comunicados & Blog</span>
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          className={`px-4 py-3 rounded-xl flex items-center justify-center gap-2 text-xs font-extrabold uppercase tracking-wide shrink-0 transition-all cursor-pointer ${
            activeTab === 'analytics' ? 'bg-gray-950 text-white shadow-md' : 'text-gray-500 hover:bg-white/40'
          }`}
        >
          <ChartIcon size={16} />
          <span>Analíticas</span>
        </button>

        <button
          onClick={() => setActiveTab('community')}
          className={`px-4 py-3 rounded-xl flex items-center justify-center gap-2 text-xs font-extrabold uppercase tracking-wide shrink-0 transition-all cursor-pointer ${
            activeTab === 'community' ? 'bg-gray-950 text-white shadow-md' : 'text-gray-500 hover:bg-white/40'
          }`}
        >
          <Globe size={16} />
          <span>Comunidad</span>
        </button>
      </div>

      <div className="animate-fade-in">
        {activeTab === 'approvals' && <AdminApprovals showToast={showToast} />}
        {activeTab === 'students' && <AdminUsers showToast={showToast} />}
        {activeTab === 'content' && <AdminContent showToast={showToast} />}
        {activeTab === 'comms' && <AdminComms showToast={showToast} />}
        {activeTab === 'analytics' && <AdminAnalytics />}
        {activeTab === 'community' && <AdminCommunity showToast={showToast} />}
      </div>

    </div>
  );
}
