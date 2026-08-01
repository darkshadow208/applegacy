-- Tabla de Metas de Estudio
CREATE TABLE IF NOT EXISTS public.study_goals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.users_profiles(id) ON DELETE CASCADE,
  text text NOT NULL,
  period text NOT NULL CHECK (period IN ('weekly', 'monthly')),
  completed boolean DEFAULT false,
  subtasks jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabla de Tareas
CREATE TABLE IF NOT EXISTS public.study_tasks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.users_profiles(id) ON DELETE CASCADE,
  text text NOT NULL,
  completed boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabla de Hábitos
CREATE TABLE IF NOT EXISTS public.study_habits (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.users_profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  streak integer DEFAULT 0,
  completed_today boolean DEFAULT false,
  last_completed_date date,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabla de Perfil de Estudio (Horarios)
CREATE TABLE IF NOT EXISTS public.student_study_profile (
  user_id uuid PRIMARY KEY REFERENCES public.users_profiles(id) ON DELETE CASCADE,
  daily_time_goal integer DEFAULT 45,
  schedule_slots jsonb DEFAULT '["Lunes 18:00", "Miércoles 20:00", "Viernes 18:00"]'::jsonb,
  reminders_enabled boolean DEFAULT true,
  reminder_times jsonb DEFAULT '["09:00", "18:00"]'::jsonb,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Configuraciones de Cursos del Estudiante (Progreso)
CREATE TABLE IF NOT EXISTS public.course_student_configs (
  user_id uuid REFERENCES public.users_profiles(id) ON DELETE CASCADE,
  course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE,
  status text DEFAULT 'pending',
  priority text DEFAULT 'medium',
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (user_id, course_id)
);

-- Habilitar RLS
ALTER TABLE public.study_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_study_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_student_configs ENABLE ROW LEVEL SECURITY;

-- Políticas de lectura/escritura (Solo el propio usuario puede acceder a sus datos)
CREATE POLICY "Usuarios pueden ver sus propias metas" ON public.study_goals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Usuarios pueden insertar sus propias metas" ON public.study_goals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Usuarios pueden actualizar sus propias metas" ON public.study_goals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Usuarios pueden eliminar sus propias metas" ON public.study_goals FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Usuarios pueden ver sus propias tareas" ON public.study_tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Usuarios pueden insertar sus propias tareas" ON public.study_tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Usuarios pueden actualizar sus propias tareas" ON public.study_tasks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Usuarios pueden eliminar sus propias tareas" ON public.study_tasks FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Usuarios pueden ver sus propios habitos" ON public.study_habits FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Usuarios pueden insertar sus propios habitos" ON public.study_habits FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Usuarios pueden actualizar sus propios habitos" ON public.study_habits FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Usuarios pueden eliminar sus propios habitos" ON public.study_habits FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Usuarios pueden ver su perfil de estudio" ON public.student_study_profile FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Usuarios pueden insertar su perfil de estudio" ON public.student_study_profile FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Usuarios pueden actualizar su perfil de estudio" ON public.student_study_profile FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Usuarios pueden ver sus configuraciones de curso" ON public.course_student_configs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Usuarios pueden insertar sus configuraciones de curso" ON public.course_student_configs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Usuarios pueden actualizar sus configuraciones de curso" ON public.course_student_configs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Usuarios pueden eliminar sus configuraciones de curso" ON public.course_student_configs FOR DELETE USING (auth.uid() = user_id);
