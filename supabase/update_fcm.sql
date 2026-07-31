-- Añadir la columna fcm_token a users_profiles para Push Notifications
ALTER TABLE public.users_profiles
ADD COLUMN IF NOT EXISTS fcm_token text;
