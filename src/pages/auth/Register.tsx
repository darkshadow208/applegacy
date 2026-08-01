import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, ArrowRight, Loader2, Phone, Send, Calendar, UploadCloud } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export function Register() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [telegram, setTelegram] = useState('');
  const [startDate, setStartDate] = useState('');
  const [receipt, setReceipt] = useState<File | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receipt) {
      setError('Por favor sube tu comprobante de pago.');
      return;
    }
    
    setLoading(true);
    setError('');

    try {
      // 1. Upload receipt
      const fileExt = receipt.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('payment_receipts')
        .upload(filePath, receipt, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // 2. Get public URL (or just store the path, but public URL is easier)
      const { data: { publicUrl } } = supabase.storage
        .from('payment_receipts')
        .getPublicUrl(filePath);

      // 3. Sign up the user
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            phone: phone,
            telegram: telegram,
            start_date: startDate,
            payment_receipt_url: publicUrl
          }
        }
      });

      if (signUpError) throw signUpError;
      
      // User created
      navigate('/auth/pending');
    } catch (err: any) {
      setError(err.message || 'Error al registrarse. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="flex flex-col gap-5" onSubmit={handleRegister}>
      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-100">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre completo</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <User className="h-5 w-5 text-gray-400" />
            </div>
            <input 
              type="text" 
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Tu nombre" 
              className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all sm:text-sm bg-gray-50/50" 
              required
            />
          </div>
        </div>

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
              placeholder="tu@email.com" 
              className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all sm:text-sm bg-gray-50/50" 
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Teléfono</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Phone className="h-5 w-5 text-gray-400" />
              </div>
              <input 
                type="tel" 
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 234 567 8900" 
                className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all sm:text-sm bg-gray-50/50" 
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Usuario de Telegram</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Send className="h-5 w-5 text-gray-400" />
              </div>
              <input 
                type="text" 
                value={telegram}
                onChange={(e) => setTelegram(e.target.value)}
                placeholder="@usuario" 
                className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all sm:text-sm bg-gray-50/50" 
                required
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                minLength={6}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Fecha de Suscripción</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Calendar className="h-5 w-5 text-gray-400" />
              </div>
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all sm:text-sm bg-gray-50/50" 
                required
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Comprobante de Pago</label>
          <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg bg-gray-50/50 hover:bg-gray-50 transition-colors">
            <div className="space-y-1 text-center">
              <UploadCloud className="mx-auto h-10 w-10 text-gray-400" />
              <div className="flex text-sm text-gray-600 justify-center">
                <label className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500">
                  <span>Subir archivo</span>
                  <input type="file" className="sr-only" accept="image/*,.pdf" onChange={(e) => setReceipt(e.target.files?.[0] || null)} required />
                </label>
              </div>
              <p className="text-xs text-gray-500">
                {receipt ? receipt.name : 'PNG, JPG, PDF hasta 5MB'}
              </p>
            </div>
          </div>
        </div>

      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 bg-black hover:bg-gray-900 text-white py-2.5 px-4 rounded-lg font-medium transition-all active:scale-[0.98] disabled:opacity-70 mt-2"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Creando cuenta...
          </>
        ) : (
          <>
            Crear cuenta
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>

      <p className="text-center text-sm text-gray-600 mt-2">
        ¿Ya tienes una cuenta?{' '}
        <Link to="/auth/login" className="font-medium text-black hover:underline">
          Inicia sesión
        </Link>
      </p>
    </form>
  );
}
