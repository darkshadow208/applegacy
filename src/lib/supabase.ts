import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key';

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.warn('⚠️ ADVERTENCIA: Faltan las variables de entorno de Supabase (.env.local). La aplicación está usando valores placeholder y fallará al hacer peticiones reales.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
