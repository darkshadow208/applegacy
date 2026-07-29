import { useAuthStore } from '../../store/authStore';
import { LogOut } from 'lucide-react';
export function PendingApproval() {
  const { signOut } = useAuthStore();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (err) {
      console.warn('Sign out failed, performing fallback redirect:', err);
    } finally {
      // Forzar una redirección limpia recargando el estado del navegador
      window.location.href = '/auth/login';
    }
  };

  return (
    <div className="flex flex-col items-center justify-center text-center gap-4 py-4 animate-fade-in">
      <div className="w-16 h-16 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mb-2">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h2 className="text-2xl font-bold text-gray-900">Cuenta en Revisión</h2>
      <p className="text-gray-500 text-sm leading-relaxed px-4">
        Tu registro ha sido recibido. Un administrador revisará y aprobará tu cuenta pronto. 
        Recibirás una notificación cuando puedas acceder.
      </p>
      <button 
        onClick={handleSignOut}
        className="mt-6 flex items-center justify-center gap-2 py-3 px-6 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-colors w-full"
      >
        <LogOut size={18} />
        Cerrar sesión y volver
      </button>
    </div>
  );
}
