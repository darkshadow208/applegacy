import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, ArrowRight, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message === 'Invalid login credentials' ? 'Correo o contraseña incorrectos.' : signInError.message);
      setLoading(false);
    } else {
      // The authStore listener in App.tsx will handle the redirect, but we can force it here
      navigate('/dashboard');
    }
  };

  return (
    <form className="flex flex-col gap-5" onSubmit={handleLogin}>
      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-100">
          {error}
        </div>
      )}
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Correo electrónico</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Mail className="h-5 w-5 text-gray-400" />
            </div>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com" 
              className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all sm:text-sm bg-gray-50/50" 
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Contraseña</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Lock className="h-5 w-5 text-gray-400" />
            </div>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••" 
              className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all sm:text-sm bg-gray-50/50" 
              required
            />
          </div>
          <div className="flex justify-end mt-1.5">
            <a href="#" className="text-xs text-gray-500 hover:text-black transition-colors font-medium">¿Olvidaste tu contraseña?</a>
          </div>
        </div>
      </div>

      <button 
        type="submit" 
        disabled={loading}
        className="group relative w-full flex justify-center py-2.5 px-4 border border-transparent text-sm font-semibold rounded-lg text-white bg-black hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black transition-all shadow-sm mt-2 disabled:opacity-70"
      >
        {loading ? <Loader2 className="animate-spin h-5 w-5" /> : (
          <>
            Iniciar sesión
            <ArrowRight className="ml-2 h-4 w-4 opacity-70 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
          </>
        )}
      </button>

      <div className="text-center mt-4">
        <p className="text-sm text-gray-600">
          ¿Aún no eres miembro?{' '}
          <Link to="/auth/register" className="font-semibold text-black hover:underline">
            Solicita acceso
          </Link>
        </p>
      </div>
    </form>
  );
}
