-- 1. Habilitar RLS en Cursos y Bonos
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bonuses ENABLE ROW LEVEL SECURITY;

-- 2. Políticas de Seguridad (Cursos)
-- Los administradores pueden hacer todo
CREATE POLICY "Admins_all_courses" ON public.courses
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users_profiles
      WHERE users_profiles.id = auth.uid() AND users_profiles.role = 'admin'
    )
  );

-- Usuarios normales solo pueden ver cursos activos SI su suscripción está activa
CREATE POLICY "Users_view_active_courses_if_subscribed" ON public.courses
  FOR SELECT USING (
    is_active = true 
    AND 
    EXISTS (
      SELECT 1 FROM public.subscriptions
      WHERE subscriptions.user_id = auth.uid() AND subscriptions.status = 'active'
    )
  );


-- 3. Políticas de Seguridad (Bonos)
-- Los administradores pueden hacer todo
CREATE POLICY "Admins_all_bonuses" ON public.bonuses
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users_profiles
      WHERE users_profiles.id = auth.uid() AND users_profiles.role = 'admin'
    )
  );

-- Usuarios normales solo pueden ver bonos activos y globales SI su suscripción está activa
CREATE POLICY "Users_view_active_global_bonuses_if_subscribed" ON public.bonuses
  FOR SELECT USING (
    is_active = true 
    AND 
    is_global = true
    AND 
    EXISTS (
      SELECT 1 FROM public.subscriptions
      WHERE subscriptions.user_id = auth.uid() AND subscriptions.status = 'active'
    )
  );
