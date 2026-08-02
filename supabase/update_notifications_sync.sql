-- Add columns to users_profiles to track and synchronize global notifications read/delete status across devices (web and mobile)
ALTER TABLE public.users_profiles 
ADD COLUMN IF NOT EXISTS read_global_notifs UUID[] DEFAULT '{}'::uuid[],
ADD COLUMN IF NOT EXISTS deleted_global_notifs UUID[] DEFAULT '{}'::uuid[];
