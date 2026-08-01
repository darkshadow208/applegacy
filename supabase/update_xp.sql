-- Añadir columna de XP a perfiles
ALTER TABLE public.users_profiles
ADD COLUMN IF NOT EXISTS xp INTEGER DEFAULT 0 NOT NULL;

-- Crear función RPC segura para otorgar XP
CREATE OR REPLACE FUNCTION public.add_user_xp(p_user_id UUID, p_amount INTEGER)
RETURNS void AS $$
BEGIN
  -- Verificar que el usuario que ejecuta esto es el mismo dueño (o un administrador)
  IF auth.uid() = p_user_id OR EXISTS(SELECT 1 FROM public.users_profiles WHERE id = auth.uid() AND role = 'admin'::public.user_role) THEN
    UPDATE public.users_profiles
    SET xp = xp + p_amount
    WHERE id = p_user_id;
  ELSE
    RAISE EXCEPTION 'No autorizado para añadir XP a este usuario';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
