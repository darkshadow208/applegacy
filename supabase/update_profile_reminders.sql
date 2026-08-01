-- Añadir la columna reminder_times a student_study_profile para guardar las horas de aviso
ALTER TABLE public.student_study_profile 
ADD COLUMN IF NOT EXISTS reminder_times TEXT[] DEFAULT ARRAY['09:00', '18:00']::TEXT[] NOT NULL;
