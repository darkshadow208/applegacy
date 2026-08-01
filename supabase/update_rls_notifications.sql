-- Permite a los usuarios leer sus propias notificaciones o todas si son administradores
DROP POLICY IF EXISTS "Users can read own notifications" ON public.notifications;
CREATE POLICY "Users can read own notifications"
ON public.notifications FOR SELECT
USING (
  auth.uid() = user_id 
  OR 
  user_id IS NULL
  OR
  EXISTS(SELECT 1 FROM public.users_profiles WHERE id = auth.uid() AND role = 'admin'::public.user_role)
);

-- Permite a los usuarios insertar notificaciones (necesario para avisos de expiración y aportes locales)
-- Un usuario normal solo puede insertarse a sí mismo o al admin.
DROP POLICY IF EXISTS "Users can insert notifications" ON public.notifications;
CREATE POLICY "Users can insert notifications"
ON public.notifications FOR INSERT
WITH CHECK (
  -- El usuario se notifica a sí mismo
  auth.uid() = user_id 
  OR 
  -- El usuario es administrador (puede notificar a cualquiera)
  EXISTS(SELECT 1 FROM public.users_profiles WHERE id = auth.uid() AND role = 'admin'::public.user_role)
  OR
  -- El usuario está enviando una notificación al administrador (ej. al crear un aporte)
  EXISTS(SELECT 1 FROM public.users_profiles WHERE id = user_id AND role = 'admin'::public.user_role)
);

-- Permite a los usuarios actualizar sus propias notificaciones (marcar como leídas)
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications"
ON public.notifications FOR UPDATE
USING (
  auth.uid() = user_id
  OR
  EXISTS(SELECT 1 FROM public.users_profiles WHERE id = auth.uid() AND role = 'admin'::public.user_role)
);

-- Permite a los usuarios borrar sus propias notificaciones
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
CREATE POLICY "Users can delete own notifications"
ON public.notifications FOR DELETE
USING (
  auth.uid() = user_id
  OR
  EXISTS(SELECT 1 FROM public.users_profiles WHERE id = auth.uid() AND role = 'admin'::public.user_role)
);
