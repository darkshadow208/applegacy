-- =========================================================================
-- SCRIPT DE MIGRACIÓN Y ENDURECIMIENTO DE SEGURIDAD (SECURITY FIXES)
-- =========================================================================

-- 1. PROTECCIÓN DE PRIVILEGIOS EN users_profiles
-- Evita que cualquier usuario ordinario pueda autoproclamarse 'admin' o 'approved'
CREATE OR REPLACE FUNCTION public.protect_user_profile_privileges()
RETURNS TRIGGER AS $$
BEGIN
  -- Si el usuario intenta cambiar su propio rol o estado
  IF (OLD.role IS DISTINCT FROM NEW.role OR OLD.status IS DISTINCT FROM NEW.status) THEN
    -- Solo un administrador autenticado puede modificar estos campos
    IF NOT public.is_admin(auth.uid()) THEN
      RAISE EXCEPTION 'Acción denegada: No tienes permisos para modificar tu rol o estado.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_protect_user_profile_privileges ON public.users_profiles;
CREATE TRIGGER tr_protect_user_profile_privileges
  BEFORE UPDATE ON public.users_profiles
  FOR EACH ROW
  EXECUTE PROCEDURE public.protect_user_profile_privileges();

-- 2. BLINDAJE DE LA TABLA subscriptions
-- Eliminar la política permisiva que permitía a cualquiera asignarse 'active' o fechas futuras
DROP POLICY IF EXISTS "Users can update own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can update own subscription for renewal" ON public.subscriptions;

-- Nueva política estricta: Los usuarios regulares SOLO pueden solicitar renovación
-- marcando el estado como 'pending_renewal' y subiendo su comprobante
CREATE POLICY "Users can update own subscription for renewal" 
ON public.subscriptions 
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id 
  AND status = 'pending_renewal'
);

-- 3. VALIDACIÓN Y PROTECCIÓN DEL SISTEMA DE EXPERIENCIA (XP)
-- Evitar XP negativo o sumas desorbitadas mediante RPC
CREATE OR REPLACE FUNCTION public.add_user_xp(p_user_id UUID, p_amount INTEGER)
RETURNS void AS $$
BEGIN
  -- Validar que la cantidad sea razonable (entre -200 y 200 XP por acción)
  IF p_amount < -200 OR p_amount > 200 THEN
    RAISE EXCEPTION 'Cantidad de XP no válida. Rango permitido: -200 a +200.';
  END IF;

  -- Verificar que el usuario que ejecuta esto es el dueño o un administrador
  IF auth.uid() = p_user_id OR public.is_admin(auth.uid()) THEN
    UPDATE public.users_profiles
    SET xp = GREATEST(0, xp + p_amount)
    WHERE id = p_user_id;
  ELSE
    RAISE EXCEPTION 'No autorizado para modificar XP de este usuario.';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. SEGURIDAD DEL STORAGE (COMPROBANTES DE PAGO)
-- Asegurar que el bucket payment_receipts solo permita inserción a usuarios autenticados
-- y lectura privada al dueño o administradores
DROP POLICY IF EXISTS "Users can upload their own receipts." ON storage.objects;
DROP POLICY IF EXISTS "Payment receipts are publicly accessible." ON storage.objects;
DROP POLICY IF EXISTS "Users and Admins view receipts" ON storage.objects;

DROP POLICY IF EXISTS "Authenticated users upload receipts" ON storage.objects;
DROP POLICY IF EXISTS "Allow upload receipts" ON storage.objects;

-- Subida de comprobantes con validación de extensión (permite registro inicial y renovaciones)
CREATE POLICY "Allow upload receipts" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'payment_receipts' 
  AND LOWER(storage.extension(name)) IN ('jpg', 'jpeg', 'png', 'webp', 'pdf')
);

-- Lectura restringida: Solo el creador del comprobante o administradores
CREATE POLICY "Users and Admins view receipts" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'payment_receipts' 
  AND (auth.uid() = owner OR public.is_admin(auth.uid()))
);

-- 5. SOPORTE MULTI-DISPOSITIVO PARA NOTIFICACIONES PUSH
CREATE TABLE IF NOT EXISTS public.user_push_devices (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users_profiles(id) ON DELETE CASCADE,
  fcm_token TEXT NOT NULL,
  platform VARCHAR(50) DEFAULT 'web',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, fcm_token)
);

ALTER TABLE public.user_push_devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own push devices" ON public.user_push_devices;
CREATE POLICY "Users manage own push devices" 
ON public.user_push_devices 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Fin del script de seguridad
