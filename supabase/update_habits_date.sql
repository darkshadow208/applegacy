-- Add missing last_completed_date column to study_habits
ALTER TABLE public.study_habits 
ADD COLUMN IF NOT EXISTS last_completed_date TEXT;
