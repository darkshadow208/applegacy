-- 1. Crear tabla de Favoritos
CREATE TABLE public.favorite_courses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users_profiles(id) ON DELETE CASCADE,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, course_id)
);

-- Habilitar RLS para Favoritos
ALTER TABLE public.favorite_courses ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para Favoritos (cada usuario ve, inserta y elimina los suyos)
CREATE POLICY "Users can view own favorites" ON public.favorite_courses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own favorites" ON public.favorite_courses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own favorites" ON public.favorite_courses FOR DELETE USING (auth.uid() = user_id);

-- 2. Crear buckets específicos (si no existen)
-- Nota: Si usas la interfaz web de Supabase, puedes crear los buckets 'avatars' (público) y 'payment_receipts' (privado)
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('payment_receipts', 'payment_receipts', true) ON CONFLICT (id) DO UPDATE SET public = true;

-- Dar permisos para avatares
CREATE POLICY "Avatar images are publicly accessible." ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Anyone can upload an avatar." ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars');
CREATE POLICY "Anyone can update their own avatar." ON storage.objects FOR UPDATE USING (auth.uid() = owner) WITH CHECK (bucket_id = 'avatars');

-- Dar permisos para recibos de pago
DROP POLICY IF EXISTS "Users can upload their own receipts." ON storage.objects;
CREATE POLICY "Users can upload their own receipts." ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'payment_receipts');

DROP POLICY IF EXISTS "Users can view their own receipts." ON storage.objects;
DROP POLICY IF EXISTS "Payment receipts are publicly accessible." ON storage.objects;
CREATE POLICY "Payment receipts are publicly accessible." ON storage.objects FOR SELECT USING (bucket_id = 'payment_receipts');

-- 3. Habilitar políticas de RLS adicionales para suscripciones y perfiles
-- Permitir que usuarios autenticados vean cualquier perfil (necesario para ver nombres en los aportes de Comunidad)
CREATE POLICY "Authenticated users can view any profile" ON public.users_profiles FOR SELECT USING (auth.role() = 'authenticated');

-- Permitir que los usuarios vean su propia suscripción
CREATE POLICY "Users can view own subscription" ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own subscription" ON public.subscriptions FOR UPDATE USING (auth.uid() = user_id);

-- Permitir consultar las categorías de cursos (necesario para el catálogo)
CREATE POLICY "Authenticated users can view categories" ON public.course_categories FOR SELECT USING (auth.role() = 'authenticated');

-- Permitir consultar los bonos
CREATE POLICY "Authenticated users can view bonuses" ON public.bonuses FOR SELECT USING (auth.role() = 'authenticated' AND is_active = true);
CREATE POLICY "Users can view own bonuses" ON public.user_bonuses FOR SELECT USING (auth.uid() = user_id);

-- 3. Insertar aportes de prueba asociados a cualquier usuario que ya exista en la base de datos
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Obtener el primer usuario registrado en la tabla
  SELECT id INTO v_user_id FROM public.users_profiles LIMIT 1;
  
  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.user_contributions (user_id, title, description, link_url, contribution_type, status)
    VALUES 
      (v_user_id, 'Libro de Copywriting Avanzado', 'Un recurso indispensable para aprender los gatillos mentales de las ventas por escrito. PDF de Google Drive.', 'https://drive.google.com/file/d/12345/view', 'book', 'approved'),
      (v_user_id, 'Hack de Facebook Ads para escala rápida', 'Tip rápido: cómo estructurar tus campañas CBO para no fatigar audiencias en presupuestos diarios altos.', NULL, 'tip', 'approved'),
      (v_user_id, 'Plantilla Notion de Organización Semanal', 'Esta es la plantilla que utilizo personalmente para planificar mis metas mensuales y proyectos en Legacy.', 'https://notion.so/template-placeholder', 'link', 'approved'),
      (v_user_id, 'Aporte en espera de revisión', 'Este es un aporte enviado de prueba para ver el flujo administrativo en el backend.', 'https://google.com', 'link', 'pending')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- 4. TABLAS PARA EL PLAN DE ESTUDIO Y ORGANIZACIÓN

-- Tabla de Metas de Estudio
CREATE TABLE IF NOT EXISTS public.study_goals (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users_profiles(id) ON DELETE CASCADE NOT NULL,
  text TEXT NOT NULL,
  period VARCHAR(20) DEFAULT 'weekly' CHECK (period IN ('weekly', 'monthly')),
  completed BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS para Metas de Estudio
ALTER TABLE public.study_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own study goals" ON public.study_goals 
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Tabla de Tareas de Estudio
CREATE TABLE IF NOT EXISTS public.study_tasks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users_profiles(id) ON DELETE CASCADE NOT NULL,
  text TEXT NOT NULL,
  completed BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS para Tareas
ALTER TABLE public.study_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own study tasks" ON public.study_tasks 
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Tabla de Hábitos
CREATE TABLE IF NOT EXISTS public.study_habits (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users_profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  streak INTEGER DEFAULT 0 NOT NULL,
  completed_today BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS para Hábitos
ALTER TABLE public.study_habits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own study habits" ON public.study_habits 
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Tabla de Configuración Personalizada por Curso (Estado y Prioridad)
CREATE TABLE IF NOT EXISTS public.course_student_configs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users_profiles(id) ON DELETE CASCADE NOT NULL,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'progress', 'completed')),
  priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, course_id)
);

-- Habilitar RLS para Configuración de Curso
ALTER TABLE public.course_student_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own course configs" ON public.course_student_configs 
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Tabla de Perfil y Configuración de Estudio del Estudiante
CREATE TABLE IF NOT EXISTS public.student_study_profile (
  user_id UUID REFERENCES public.users_profiles(id) ON DELETE CASCADE PRIMARY KEY,
  daily_time_goal INTEGER DEFAULT 45 NOT NULL,
  schedule_slots TEXT[] DEFAULT ARRAY['Lunes 18:00', 'Miércoles 20:00', 'Viernes 18:00']::TEXT[] NOT NULL,
  reminders_enabled BOOLEAN DEFAULT true NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS para Perfil de Estudio
ALTER TABLE public.student_study_profile ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own study profile" ON public.student_study_profile 
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =========================================================================
-- ⚡ PARTE DEL ADMINISTRADOR: GESTIÓN DE ROLES Y CREACIÓN DE ADMINS
-- =========================================================================

-- OPCIÓN A: Convertir un usuario ya registrado en Administrador
-- Ejecuta este bloque reemplazando el correo electrónico por el correo real de tu cuenta:
UPDATE public.users_profiles
SET 
  role = 'admin'::user_role,
  status = 'approved'::user_status
WHERE email = 'correo-admin@tu-plataforma.com';


-- OPCIÓN B: Crear un nuevo administrador completamente desde cero (Supabase Auth + Profile)
-- Ejecuta este script en el editor SQL de Supabase para registrar y autorizar a un administrador de forma directa:
-- Reemplaza 'correo-admin@tu-plataforma.com' y 'ContrasenaSegura123!' por los datos deseados:

DO $$
DECLARE
  new_user_id UUID := gen_random_uuid();
  admin_email TEXT := 'correo-admin@tu-plataforma.com';
  admin_password TEXT := 'ContrasenaSegura123!';
  admin_fullname TEXT := 'Administrador Principal';
BEGIN
  -- 1. Insertar el usuario en la tabla de autenticación de Supabase (auth.users) si no existe
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = admin_email) THEN
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_super_admin,
      role,
      aud,
      created_at,
      updated_at
    )
    VALUES (
      new_user_id,
      '00000000-0000-0000-0000-000000000000',
      admin_email,
      crypt(admin_password, gen_salt('bf')),
      now(),
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      jsonb_build_object('full_name', admin_fullname),
      false,
      'authenticated',
      'authenticated',
      now(),
      now()
    );
  END IF;

  -- 2. Asegurar que el trigger 'on_auth_user_created' actualizó su rol a 'admin' y estado a 'approved'
  UPDATE public.users_profiles
  SET 
    role = 'admin'::user_role,
    status = 'approved'::user_status,
    full_name = admin_fullname
  WHERE email = admin_email;

  -- 3. Asegurar que tiene suscripción activa como administrador
  UPDATE public.subscriptions
  SET status = 'active'::subscription_status
  WHERE user_id = (SELECT id FROM public.users_profiles WHERE email = admin_email);

END $$;

-- =========================================================================
-- ⚡ POLÍTICAS DE RLS DE PODER ABSOLUTO PARA EL ROL DE ADMINISTRADOR
-- =========================================================================

-- Helper para verificar rol de admin de forma segura y sin recursividad
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users_profiles 
    WHERE id = user_id AND role = 'admin'::public.user_role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Eliminar políticas conflictivas previas si existen
DROP POLICY IF EXISTS "Admins can do everything on profiles" ON public.users_profiles;
DROP POLICY IF EXISTS "Admins can do everything on subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Admins can do everything on payments" ON public.payments;
DROP POLICY IF EXISTS "Admins can do everything on courses" ON public.courses;
DROP POLICY IF EXISTS "Admins can do everything on course_categories" ON public.course_categories;
DROP POLICY IF EXISTS "Admins can do everything on bonuses" ON public.bonuses;
DROP POLICY IF EXISTS "Admins can do everything on user_bonuses" ON public.user_bonuses;
DROP POLICY IF EXISTS "Admins can do everything on news_posts" ON public.news_posts;
DROP POLICY IF EXISTS "Admins can do everything on user_contributions" ON public.user_contributions;
DROP POLICY IF EXISTS "Admins can do everything on notifications" ON public.notifications;

-- Crear políticas ALL para administradores autenticados
CREATE POLICY "Admins can do everything on profiles" ON public.users_profiles 
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can do everything on subscriptions" ON public.subscriptions 
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can do everything on payments" ON public.payments 
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can do everything on courses" ON public.courses 
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can do everything on course_categories" ON public.course_categories 
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can do everything on bonuses" ON public.bonuses 
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can do everything on user_bonuses" ON public.user_bonuses 
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can do everything on news_posts" ON public.news_posts 
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can do everything on user_contributions" ON public.user_contributions 
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can do everything on notifications" ON public.notifications 
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

