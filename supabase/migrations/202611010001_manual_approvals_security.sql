-- Aplicar después del esquema existente, antes de publicar el nuevo cliente.
-- La aprobación es MANUAL. No hay pasarela ni webhook de pagos.
BEGIN;

CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.users_profiles WHERE id = user_id AND role = 'admin'); $$;

ALTER TABLE public.users_profiles ADD COLUMN IF NOT EXISTS first_approved_at timestamptz;
ALTER TABLE public.users_profiles ADD COLUMN IF NOT EXISTS fcm_token text;
ALTER TABLE public.users_profiles ADD COLUMN IF NOT EXISTS xp integer NOT NULL DEFAULT 0;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'renewal'
  CHECK (purpose IN ('initial', 'renewal'));
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS plan_name text DEFAULT 'Mensual VIP';
ALTER TABLE public.study_goals ADD COLUMN IF NOT EXISTS subtasks jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.study_habits ADD COLUMN IF NOT EXISTS last_completed_date date;
-- Marcar altas históricas sin volver a concederles días.
UPDATE public.users_profiles SET first_approved_at = created_at
WHERE first_approved_at IS NULL AND (status = 'approved' OR EXISTS (
  SELECT 1 FROM public.subscriptions s WHERE s.user_id=users_profiles.id AND s.end_date IS NOT NULL
));
UPDATE public.payments p SET purpose = 'initial'
WHERE purpose <> 'initial' AND (notes = 'Comprobante de registro inicial' OR EXISTS (
  SELECT 1 FROM public.users_profiles u WHERE u.id = p.user_id AND p.receipt_url = u.payment_receipt_url
));
UPDATE public.payments p SET status = 'approved'
FROM public.users_profiles u
WHERE p.user_id = u.id AND p.purpose = 'initial' AND p.status = 'pending'
  AND u.first_approved_at IS NOT NULL;

-- No borrar ni elegir arbitrariamente fechas históricas en producción.
-- Si hay duplicados, toda la migración revierte y se deben reconciliar primero.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.subscriptions GROUP BY user_id HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Hay suscripciones duplicadas. Reconciliar sus fechas antes de migrar.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.course_student_configs GROUP BY user_id, course_id HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Hay configuraciones de cursos duplicadas. Reconciliarlas antes de migrar.';
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_one_per_user ON public.subscriptions(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS course_configs_one_per_course ON public.course_student_configs(user_id, course_id);
CREATE INDEX IF NOT EXISTS payments_user_status ON public.payments(user_id, status);
-- Recuperar días ya aprobados que el cliente antiguo había marcado como pendientes.
UPDATE public.subscriptions SET status=CASE WHEN end_date>now() THEN 'active'::public.subscription_status
  ELSE 'expired'::public.subscription_status END
WHERE status='pending_renewal' AND end_date IS NOT NULL;

CREATE OR REPLACE FUNCTION public.has_premium_access()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.is_admin(auth.uid()) OR EXISTS (
  SELECT 1 FROM public.users_profiles u JOIN public.subscriptions s ON s.user_id = u.id
  WHERE u.id = auth.uid() AND u.status = 'approved' AND s.status = 'active'
    AND s.start_date <= now() AND s.end_date > now()
); $$;

-- Reemplazar TODAS las políticas antiguas de estas tablas: las permisivas se suman con OR.
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public'
    AND tablename IN ('users_profiles', 'subscriptions', 'courses', 'bonuses', 'payments', 'user_contributions')
  LOOP EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, p.tablename); END LOOP;
END $$;
ALTER TABLE public.users_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bonuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_contributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_private_read ON public.users_profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY profiles_private_update ON public.users_profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY subscriptions_read ON public.subscriptions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
-- Escritura solo por las RPC de abajo, incluso para el cliente administrador.
REVOKE INSERT, UPDATE, DELETE ON public.subscriptions FROM anon, authenticated;

CREATE POLICY courses_premium_read ON public.courses FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR (is_active AND public.has_premium_access()));
CREATE POLICY courses_admin_write ON public.courses FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY bonuses_premium_read ON public.bonuses FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR (is_active AND public.has_premium_access() AND
    (is_global OR EXISTS (SELECT 1 FROM public.user_bonuses ub WHERE ub.user_id = auth.uid() AND ub.bonus_id = bonuses.id))));
CREATE POLICY bonuses_admin_write ON public.bonuses FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
DROP POLICY IF EXISTS news_admin_write ON public.news_posts;
CREATE POLICY news_admin_write ON public.news_posts FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
DROP POLICY IF EXISTS user_bonuses_private_read ON public.user_bonuses;
CREATE POLICY user_bonuses_private_read ON public.user_bonuses FOR SELECT TO authenticated
  USING (user_id=auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY payments_read ON public.payments FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY payments_pending_insert ON public.payments FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'pending' AND purpose = 'renewal'
    AND amount > 0 AND payment_date <= CURRENT_DATE
    AND EXISTS (SELECT 1 FROM public.users_profiles WHERE id = auth.uid() AND status = 'approved')
    AND EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'payment_receipts'
      AND name = receipt_url AND owner_id = auth.uid()::text));
-- Un pago solo se revisa mediante admin_review_payment (incluye extensión y aviso).
REVOKE UPDATE, DELETE ON public.payments FROM anon, authenticated;
CREATE POLICY contributions_read ON public.user_contributions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR status = 'approved' OR public.is_admin(auth.uid()));
CREATE POLICY contributions_pending_insert ON public.user_contributions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND (status = 'pending' OR public.is_admin(auth.uid())));
CREATE POLICY contributions_admin_update ON public.user_contributions FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY contributions_admin_delete ON public.user_contributions FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- Vista deliberadamente limitada; su dueño resuelve RLS, pero solo expone estas 3 columnas.
CREATE OR REPLACE VIEW public.users_public_profiles WITH (security_barrier = true)
AS SELECT id, full_name, avatar_url FROM public.users_profiles;
REVOKE ALL ON public.users_public_profiles FROM PUBLIC, anon;
GRANT SELECT ON public.users_public_profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.protect_user_profile_privileges()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) AND (
    NEW.id IS DISTINCT FROM OLD.id OR NEW.role IS DISTINCT FROM OLD.role OR
    NEW.status IS DISTINCT FROM OLD.status OR NEW.first_approved_at IS DISTINCT FROM OLD.first_approved_at OR
    NEW.payment_receipt_url IS DISTINCT FROM OLD.payment_receipt_url
  ) THEN RAISE EXCEPTION 'Solo el administrador puede modificar la aprobación y sus datos.'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tr_protect_user_profile_privileges ON public.users_profiles;
CREATE TRIGGER tr_protect_user_profile_privileges BEFORE UPDATE ON public.users_profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_user_profile_privileges();

-- Privacidad de comprobantes, incluso si queda una política de storage desconocida.
INSERT INTO storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
VALUES ('payment_receipts', 'payment_receipts', false, 5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 5242880,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
DROP POLICY IF EXISTS receipts_read_guard ON storage.objects;
CREATE POLICY receipts_read_guard ON storage.objects AS RESTRICTIVE FOR SELECT TO public
USING (bucket_id <> 'payment_receipts' OR
  (auth.uid() IS NOT NULL AND (owner_id = auth.uid()::text OR public.is_admin(auth.uid()))));
DROP POLICY IF EXISTS receipts_private_read ON storage.objects;
CREATE POLICY receipts_private_read ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'payment_receipts' AND (owner_id = auth.uid()::text OR public.is_admin(auth.uid())));
DROP POLICY IF EXISTS receipts_upload_guard ON storage.objects;
CREATE POLICY receipts_upload_guard ON storage.objects AS RESTRICTIVE FOR INSERT TO public
WITH CHECK (bucket_id <> 'payment_receipts' OR (
  lower(storage.extension(name)) IN ('jpg','jpeg','png','webp','pdf') AND
  ((auth.uid() IS NULL AND name ~ '^registration/[0-9a-f-]{36}\.[a-z]+$') OR
   (auth.uid() IS NOT NULL AND split_part(name, '/', 1) = auth.uid()::text))
));
DROP POLICY IF EXISTS receipts_upload ON storage.objects;
CREATE POLICY receipts_upload ON storage.objects FOR INSERT TO anon, authenticated
WITH CHECK (bucket_id = 'payment_receipts');
DROP POLICY IF EXISTS receipts_update_guard ON storage.objects;
CREATE POLICY receipts_update_guard ON storage.objects AS RESTRICTIVE FOR UPDATE TO public
USING (bucket_id <> 'payment_receipts') WITH CHECK (bucket_id <> 'payment_receipts');
DROP POLICY IF EXISTS receipts_delete_guard ON storage.objects;
CREATE POLICY receipts_delete_guard ON storage.objects AS RESTRICTIVE FOR DELETE TO public
USING (bucket_id <> 'payment_receipts' OR public.is_admin(auth.uid()));

-- Alta: prueba de pago y cuenta pendiente. No se crea una renovación pendiente adicional.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE receipt text := new.raw_user_meta_data->>'payment_receipt_url';
BEGIN
  IF receipt IS NULL OR receipt !~ '^registration/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|pdf)$'
    OR NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'payment_receipts' AND name = receipt)
  THEN RAISE EXCEPTION 'Debes subir una prueba de pago válida antes de registrarte.'; END IF;
  INSERT INTO public.users_profiles(id,email,full_name,phone,telegram,payment_receipt_url,role,status)
  VALUES (new.id,new.email,new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'telegram',receipt,'user','pending');
  INSERT INTO public.subscriptions(user_id,status,payment_receipt_url) VALUES(new.id,'pending',receipt);
  RETURN new;
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_user_status(p_user_id uuid, p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u public.users_profiles; first_approval boolean;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'No autorizado'; END IF;
  IF p_status IS NULL OR p_status NOT IN ('approved','suspended') THEN RAISE EXCEPTION 'Estado no válido'; END IF;
  SELECT * INTO STRICT u FROM public.users_profiles WHERE id=p_user_id FOR UPDATE;
  first_approval := u.first_approved_at IS NULL;
  IF u.status::text = p_status THEN RETURN; END IF;
  IF p_status = 'approved' AND first_approval AND nullif(u.payment_receipt_url,'') IS NULL THEN
    RAISE EXCEPTION 'El registro no tiene comprobante para revisar'; END IF;
  UPDATE public.users_profiles SET status=p_status::public.user_status,
    first_approved_at=CASE WHEN p_status='approved' THEN coalesce(first_approved_at,now()) ELSE first_approved_at END,
    updated_at=now() WHERE id=p_user_id;
  IF p_status='approved' AND first_approval THEN
    INSERT INTO public.subscriptions(user_id,status,start_date,end_date,payment_receipt_url)
    VALUES(p_user_id,'active',now(),now()+interval '30 days',u.payment_receipt_url)
    ON CONFLICT(user_id) DO UPDATE SET status='active',start_date=EXCLUDED.start_date,
      end_date=EXCLUDED.end_date,updated_at=now();
    -- Cierra el comprobante inicial histórico en la misma operación; nunca lo extiende otra vez.
    UPDATE public.payments SET status='approved',updated_at=now()
      WHERE user_id=p_user_id AND purpose='initial' AND status='pending';
    INSERT INTO public.payments(user_id,amount,payment_date,receipt_url,notes,status,purpose)
    SELECT p_user_id,0,CURRENT_DATE,u.payment_receipt_url,'Registro aprobado manualmente','approved','initial'
    WHERE NOT EXISTS (SELECT 1 FROM public.payments WHERE user_id=p_user_id AND purpose='initial');
  END IF;
  INSERT INTO public.notifications(user_id,title,message) VALUES(p_user_id,
    CASE WHEN p_status='approved' THEN 'Cuenta aprobada' ELSE 'Cuenta suspendida' END,
    CASE WHEN p_status='approved' THEN 'El administrador aprobó tu acceso a Legacy Academy.'
      ELSE 'El administrador suspendió tu acceso. Contacta a soporte si necesitas ayuda.' END);
END $$;

CREATE OR REPLACE FUNCTION public.admin_review_payment(p_payment_id uuid, p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.payments; u public.users_profiles; s public.subscriptions;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'No autorizado'; END IF;
  IF p_status IS NULL OR p_status NOT IN ('approved','rejected') THEN RAISE EXCEPTION 'Estado no válido'; END IF;
  -- Mismo orden de locks para todas las operaciones: perfil, luego pago/suscripción.
  SELECT u1.* INTO STRICT u FROM public.users_profiles u1
    WHERE id=(SELECT user_id FROM public.payments WHERE id=p_payment_id) FOR UPDATE;
  SELECT * INTO STRICT p FROM public.payments WHERE id=p_payment_id FOR UPDATE;
  IF p.status <> 'pending' THEN
    IF p.status::text <> p_status THEN RAISE EXCEPTION 'El comprobante ya fue revisado con otra decisión'; END IF;
    RETURN;
  END IF;
  IF p.purpose <> 'renewal' THEN RAISE EXCEPTION 'El comprobante inicial se revisa aprobando la cuenta'; END IF;
  IF u.status <> 'approved' THEN RAISE EXCEPTION 'Aprueba primero la cuenta del alumno'; END IF;
  IF p_status='approved' THEN
    SELECT * INTO s FROM public.subscriptions WHERE user_id=p.user_id FOR UPDATE;
    INSERT INTO public.subscriptions(user_id,status,start_date,end_date,payment_receipt_url)
    VALUES(p.user_id,'active',coalesce(s.start_date,now()),greatest(coalesce(s.end_date,now()),now())+interval '30 days',p.receipt_url)
    ON CONFLICT(user_id) DO UPDATE SET status='active',start_date=EXCLUDED.start_date,
      end_date=EXCLUDED.end_date,payment_receipt_url=EXCLUDED.payment_receipt_url,updated_at=now();
  END IF;
  UPDATE public.payments SET status=p_status::public.payment_status,updated_at=now() WHERE id=p.id;
  INSERT INTO public.notifications(user_id,title,message) VALUES(p.user_id,
    CASE WHEN p_status='approved' THEN 'Renovación aprobada' ELSE 'Comprobante rechazado' END,
    CASE WHEN p_status='approved' THEN 'El administrador aprobó 30 días adicionales de membresía.'
      ELSE 'El administrador rechazó tu comprobante. Los días ya aprobados se conservan.' END);
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_subscription_dates(p_user_id uuid,p_start timestamptz,p_end timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'No autorizado'; END IF;
  IF p_start IS NULL OR p_end IS NULL OR p_end <= p_start THEN RAISE EXCEPTION 'Fechas no válidas'; END IF;
  PERFORM 1 FROM public.users_profiles WHERE id=p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Alumno no encontrado'; END IF;
  INSERT INTO public.subscriptions(user_id,status,start_date,end_date)
  VALUES(p_user_id,CASE WHEN p_end>now() THEN 'active'::public.subscription_status ELSE 'expired'::public.subscription_status END,p_start,p_end)
  ON CONFLICT(user_id) DO UPDATE SET status=EXCLUDED.status,start_date=p_start,end_date=p_end,updated_at=now();
  INSERT INTO public.notifications(user_id,title,message) VALUES(p_user_id,'Membresía actualizada',
    'El administrador actualizó las fechas de tu membresía. Consúltalas en tu perfil.');
END $$;

-- Avisar desde el servidor: el alumno no necesita consultar perfiles privados de admins.
CREATE OR REPLACE FUNCTION public.notify_contribution_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status='pending' THEN
    INSERT INTO public.notifications(user_id,title,message)
    SELECT id,'Nuevo aporte pendiente','Un alumno envió un recurso para revisar.' FROM public.users_profiles WHERE role='admin';
  ELSE
    INSERT INTO public.notifications(user_id,title,message) VALUES(NULL,'Nuevo aporte en la comunidad',NEW.title);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS contribution_created_notification ON public.user_contributions;
CREATE TRIGGER contribution_created_notification AFTER INSERT ON public.user_contributions
FOR EACH ROW EXECUTE FUNCTION public.notify_contribution_created();

CREATE OR REPLACE FUNCTION public.notify_content_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF TG_TABLE_NAME='bonuses' THEN
    IF NOT NEW.is_global THEN RETURN NEW; END IF;
  END IF;
  IF NEW.is_active THEN
    INSERT INTO public.notifications(user_id,title,message)
      VALUES(NULL,'Nuevo contenido disponible',NEW.title);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS content_created_notification ON public.courses;
CREATE TRIGGER content_created_notification AFTER INSERT ON public.courses
FOR EACH ROW EXECUTE FUNCTION public.notify_content_created();
DROP TRIGGER IF EXISTS content_created_notification ON public.bonuses;
CREATE TRIGGER content_created_notification AFTER INSERT ON public.bonuses
FOR EACH ROW EXECUTE FUNCTION public.notify_content_created();
DROP TRIGGER IF EXISTS content_created_notification ON public.news_posts;
CREATE TRIGGER content_created_notification AFTER INSERT ON public.news_posts
FOR EACH ROW EXECUTE FUNCTION public.notify_content_created();

DROP POLICY IF EXISTS admins_delete_assets ON storage.objects;
CREATE POLICY admins_delete_assets ON storage.objects FOR DELETE TO authenticated
USING (bucket_id='avatars' AND public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.admin_review_contribution(p_id uuid,p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.user_contributions;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'No autorizado'; END IF;
  IF p_status IS NULL OR p_status NOT IN ('approved','rejected') THEN RAISE EXCEPTION 'Estado no válido'; END IF;
  SELECT * INTO STRICT c FROM public.user_contributions WHERE id=p_id FOR UPDATE;
  IF c.status <> 'pending' THEN
    IF c.status::text <> p_status THEN RAISE EXCEPTION 'El aporte ya fue revisado con otra decisión'; END IF;
    RETURN;
  END IF;
  UPDATE public.user_contributions SET status=p_status::public.contribution_status,updated_at=now() WHERE id=p_id;
  INSERT INTO public.notifications(user_id,title,message) VALUES(c.user_id,
    CASE WHEN p_status='approved' THEN 'Aporte aprobado' ELSE 'Aporte rechazado' END,c.title);
  IF p_status='approved' THEN
    INSERT INTO public.notifications(user_id,title,message) VALUES(NULL,'Nuevo aporte en la comunidad',c.title);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.update_notification_state(p_action text,p_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE global_ids uuid[];
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autorizado'; END IF;
  IF p_action IS NULL OR p_action NOT IN ('read','clear') OR cardinality(p_ids)>2000 THEN RAISE EXCEPTION 'Acción no válida'; END IF;
  SELECT coalesce(array_agg(id),'{}'::uuid[]) INTO global_ids FROM public.notifications
    WHERE user_id IS NULL AND id=ANY(p_ids);
  IF p_action='read' THEN
    UPDATE public.notifications SET is_read=true WHERE user_id=auth.uid() AND id=ANY(p_ids);
    UPDATE public.users_profiles SET read_global_notifs=ARRAY(
      SELECT DISTINCT unnest(coalesce(read_global_notifs,'{}'::uuid[]) || global_ids)) WHERE id=auth.uid();
  ELSE
    DELETE FROM public.notifications WHERE user_id=auth.uid() AND id=ANY(p_ids);
    UPDATE public.users_profiles SET deleted_global_notifs=ARRAY(
      SELECT DISTINCT unnest(coalesce(deleted_global_notifs,'{}'::uuid[]) || global_ids)) WHERE id=auth.uid();
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.user_push_devices (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY, user_id uuid REFERENCES public.users_profiles(id) ON DELETE CASCADE,
  fcm_token text NOT NULL, platform text NOT NULL DEFAULT 'web', created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(), UNIQUE(user_id,fcm_token)
);
-- Un token corresponde a una instalación, no debe seguir asociado a dos cuentas.
DELETE FROM public.user_push_devices a USING public.user_push_devices b
WHERE a.fcm_token=b.fcm_token AND (a.updated_at,a.id)<(b.updated_at,b.id);
CREATE UNIQUE INDEX IF NOT EXISTS push_token_one_account ON public.user_push_devices(fcm_token);
ALTER TABLE public.user_push_devices ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.register_push_device(p_token text,p_platform text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR nullif(p_token,'') IS NULL OR p_platform IS NULL OR p_platform NOT IN ('web','native') THEN
    RAISE EXCEPTION 'Dispositivo no válido'; END IF;
  -- El perfil era un almacén de tokens antiguo; se retira para no reenviar al dueño anterior.
  UPDATE public.users_profiles SET fcm_token=NULL WHERE fcm_token=p_token;
  INSERT INTO public.user_push_devices(user_id,fcm_token,platform) VALUES(auth.uid(),p_token,p_platform)
  ON CONFLICT(fcm_token) DO UPDATE SET user_id=EXCLUDED.user_id,platform=EXCLUDED.platform,updated_at=now();
END $$;
CREATE OR REPLACE FUNCTION public.unregister_push_device(p_token text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autorizado'; END IF;
  DELETE FROM public.user_push_devices WHERE user_id=auth.uid() AND fcm_token=p_token;
  UPDATE public.users_profiles SET fcm_token=NULL WHERE id=auth.uid() AND fcm_token=p_token;
END $$;

-- Las funciones de negocio nunca se ejecutan de forma anónima.
REVOKE ALL ON FUNCTION public.admin_set_user_status(uuid,text), public.admin_review_payment(uuid,text),
  public.admin_set_subscription_dates(uuid,timestamptz,timestamptz),
  public.register_push_device(text,text),public.unregister_push_device(text),
  public.admin_review_contribution(uuid,text),public.update_notification_state(text,uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_status(uuid,text),public.admin_review_payment(uuid,text),
  public.admin_set_subscription_dates(uuid,timestamptz,timestamptz),
  public.register_push_device(text,text),public.unregister_push_device(text),
  public.admin_review_contribution(uuid,text),public.update_notification_state(text,uuid[]) TO authenticated;
COMMIT;
