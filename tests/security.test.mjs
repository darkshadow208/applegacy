import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const migration = await readFile(new URL('../supabase/migrations/202611010001_manual_approvals_security.sql', import.meta.url), 'utf8');
const uid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const admin = uid(1), student = uid(2), other = uid(3);
const receipt = `registration/${uid(20)}.png`;

async function setup({ legacyConfigs = false } = {}) {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE SCHEMA auth; CREATE SCHEMA storage;
    CREATE FUNCTION public.uuid_generate_v4() RETURNS uuid LANGUAGE sql AS 'SELECT gen_random_uuid()';
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS
      $$ SELECT current_user::text $$;
    CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb DEFAULT '{}');
    CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text,name text,
      owner uuid,owner_id text,UNIQUE(bucket_id,name));
    CREATE FUNCTION storage.extension(text) RETURNS text LANGUAGE sql IMMUTABLE AS
      $$ SELECT reverse(split_part(reverse($1),'.',1)) $$;
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    CREATE POLICY legacy_storage_all ON storage.objects FOR ALL USING(true) WITH CHECK(true);
    INSERT INTO storage.buckets VALUES('payment_receipts','payment_receipts',true,NULL,NULL);
  `);
  const schema = (await readFile(new URL('../supabase/schema.sql', import.meta.url),'utf8'))
    .replace('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";', '');
  await db.exec(schema);
  await db.exec(await readFile(new URL('../supabase/study_plan_schema.sql',import.meta.url),'utf8'));
  if (legacyConfigs) await db.exec(`
    ALTER TABLE public.course_student_configs DROP CONSTRAINT course_student_configs_pkey;
    ALTER TABLE public.course_student_configs ADD COLUMN id uuid DEFAULT gen_random_uuid() PRIMARY KEY;
    ALTER TABLE public.course_student_configs ADD UNIQUE(user_id,course_id);
  `);
  await db.exec(`
    CREATE POLICY legacy_profile_read ON public.users_profiles FOR SELECT USING(auth.role()='authenticated');
    CREATE POLICY legacy_bonus_read ON public.bonuses FOR SELECT USING(auth.role()='authenticated');
    INSERT INTO auth.users(id,email) VALUES('${admin}','admin@test.invalid'),('${student}','student@test.invalid'),('${other}','other@test.invalid');
    UPDATE public.users_profiles SET role='admin',status='approved' WHERE id='${admin}';
    UPDATE public.users_profiles SET payment_receipt_url='${receipt}' WHERE id='${student}';
    INSERT INTO storage.objects(bucket_id,name) VALUES('payment_receipts','${receipt}');
    INSERT INTO public.courses(id,title,drive_url) VALUES('${uid(10)}','Curso privado','https://example.invalid/premium');
    INSERT INTO public.bonuses(id,title,drive_url) VALUES('${uid(11)}','Bono privado','https://example.invalid/bonus');
    GRANT USAGE ON SCHEMA public,auth,storage TO anon,authenticated;
    GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public,storage TO anon,authenticated;
  `);
  await db.exec(migration);
  return db;
}

async function asUser(db, id, callback) {
  await db.exec(`SET ROLE ${id ? 'authenticated' : 'anon'};`);
  await db.query(`SELECT set_config('request.jwt.claim.sub',$1,false)`, [id ?? '']);
  try { return await callback(); }
  finally { await db.exec('RESET ROLE'); await db.exec(`SELECT set_config('request.jwt.claim.sub','',false)`); }
}
async function approve(db) {
  await asUser(db,admin,()=>db.query(`SELECT public.admin_set_user_status($1,'approved')`,[student]));
}

test('permisos premium y privacidad sustituyen las reglas antiguas', async () => {
  const db=await setup();
  try {
    for (const table of ['courses','bonuses']) {
      assert.equal((await asUser(db,student,()=>db.query(`SELECT * FROM public.${table}`))).rows.length,0);
      assert.equal((await asUser(db,null,()=>db.query(`SELECT * FROM public.${table}`))).rows.length,0);
    }
    assert.equal((await asUser(db,student,()=>db.query('SELECT * FROM users_profiles'))).rows.length,1);
    const visible=await asUser(db,student,()=>db.query('SELECT * FROM users_public_profiles'));
    assert.deepEqual(Object.keys(visible.rows[0]).sort(),['avatar_url','full_name','id']);
    assert.equal((await db.query(`SELECT public FROM storage.buckets WHERE id='payment_receipts'`)).rows[0].public,false);
    assert.equal((await asUser(db,student,()=>db.query(`SELECT * FROM storage.objects`))).rows.length,0);
    assert.equal((await asUser(db,null,()=>db.query(`SELECT * FROM storage.objects`))).rows.length,0);
    assert.equal((await asUser(db,admin,()=>db.query(`SELECT * FROM storage.objects`))).rows.length,1);
    await approve(db);
    assert.equal((await asUser(db,student,()=>db.query('SELECT * FROM courses'))).rows.length,1);
    await asUser(db,admin,()=>db.query(`SELECT admin_set_user_status($1,'suspended')`,[student]));
    assert.equal((await asUser(db,student,()=>db.query('SELECT * FROM courses'))).rows.length,0);
    await asUser(db,admin,()=>db.query(`SELECT admin_set_user_status($1,'approved')`,[student]));
    await db.query(`UPDATE subscriptions SET end_date=now()-interval '1 second' WHERE user_id=$1`,[student]);
    assert.equal((await asUser(db,student,()=>db.query('SELECT * FROM courses'))).rows.length,0);
  } finally { await db.close(); }
});

test('alta manual concede un solo periodo y consume el comprobante inicial histórico',async()=>{
  const db=await setup();
  try {
    await db.query(`INSERT INTO payments(user_id,payment_date,receipt_url,status,purpose) VALUES($1,CURRENT_DATE,$2,'pending','initial')`,[student,receipt]);
    await assert.rejects(asUser(db,student,()=>db.query(`SELECT admin_set_user_status($1,'approved')`,[student])),/No autorizado/);
    await approve(db);
    const before=(await db.query('SELECT end_date::text AS end_date FROM subscriptions WHERE user_id=$1',[student])).rows[0].end_date;
    await approve(db);
    assert.equal((await db.query('SELECT end_date::text AS end_date FROM subscriptions WHERE user_id=$1',[student])).rows[0].end_date,before);
    const payment=(await db.query('SELECT id,status FROM payments WHERE user_id=$1',[student])).rows[0];
    assert.equal(payment.status,'approved');
    await asUser(db,admin,()=>db.query(`SELECT admin_review_payment($1,'approved')`,[payment.id]));
    assert.equal((await db.query('SELECT end_date::text AS end_date FROM subscriptions WHERE user_id=$1',[student])).rows[0].end_date,before);
    await asUser(db,admin,()=>db.query(`SELECT admin_set_user_status($1,'suspended')`,[student]));
    await approve(db);
    assert.equal((await db.query('SELECT end_date::text AS end_date FROM subscriptions WHERE user_id=$1',[student])).rows[0].end_date,before);
  } finally { await db.close(); }
});

test('renovación pendiente/rechazada conserva acceso y aprobar dos veces extiende una vez',async()=>{
  const db=await setup();
  try {
    await approve(db);
    const path=`${student}/${uid(21)}.png`;
    await asUser(db,student,()=>db.query(`INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES('payment_receipts',$1,$2)`,[path,student]));
    const before=(await db.query('SELECT end_date::text AS end_date FROM subscriptions WHERE user_id=$1',[student])).rows[0].end_date;
    const insert=async()=>asUser(db,student,()=>db.query(`INSERT INTO payments(user_id,amount,payment_date,receipt_url) VALUES($1,10,CURRENT_DATE,$2) RETURNING id`,[student,path]));
    const first=(await insert()).rows[0].id;
    assert.equal((await asUser(db,student,()=>db.query('SELECT * FROM courses'))).rows.length,1);
    await asUser(db,admin,()=>db.query(`SELECT admin_review_payment($1,'rejected')`,[first]));
    assert.equal((await db.query('SELECT end_date::text AS end_date FROM subscriptions WHERE user_id=$1',[student])).rows[0].end_date,before);
    assert.equal((await asUser(db,student,()=>db.query('SELECT * FROM courses'))).rows.length,1);
    const second=(await insert()).rows[0].id;
    await asUser(db,admin,()=>db.query(`SELECT admin_review_payment($1,'approved')`,[second]));
    const after=(await db.query('SELECT end_date::text AS end_date FROM subscriptions WHERE user_id=$1',[student])).rows[0].end_date;
    assert.equal(new Date(after)-new Date(before),30*24*60*60*1000);
    await asUser(db,admin,()=>db.query(`SELECT admin_review_payment($1,'approved')`,[second]));
    assert.equal((await db.query('SELECT end_date::text AS end_date FROM subscriptions WHERE user_id=$1',[student])).rows[0].end_date,after);
  } finally { await db.close(); }
});

test('alumno no puede autopublicar, aprobar pagos ni modificar fechas',async()=>{
  const db=await setup();
  try {
    await approve(db);
    await assert.rejects(asUser(db,student,()=>db.query(`INSERT INTO user_contributions(user_id,title,status) VALUES($1,'Aporte','approved')`,[student])),/row-level security/);
    await assert.rejects(asUser(db,student,()=>db.query(`INSERT INTO payments(user_id,amount,payment_date,receipt_url,status) VALUES($1,10,CURRENT_DATE,$2,'approved')`,[student,receipt])),/row-level security/);
    await assert.rejects(asUser(db,student,()=>db.query(`UPDATE subscriptions SET end_date=now()+interval '1 year' WHERE user_id=$1`,[student])),/permission denied/);
    await assert.rejects(asUser(db,student,()=>db.query(`UPDATE users_profiles SET status='approved',role='admin' WHERE id=$1`,[student])),/Solo el administrador/);
    await asUser(db,student,()=>db.query(`INSERT INTO user_contributions(user_id,title) VALUES($1,'Pendiente')`,[student]));
    assert.equal((await db.query(`SELECT status FROM user_contributions`)).rows[0].status,'pending');
  } finally { await db.close(); }
});

test('editar fechas es idempotente y un fallo de aviso revierte la aprobación completa',async()=>{
  const db=await setup();
  try {
    await asUser(db,admin,()=>db.query(`SELECT admin_set_subscription_dates($1,now(),now()+interval '10 days')`,[student]));
    await asUser(db,admin,()=>db.query(`SELECT admin_set_subscription_dates($1,now(),now()+interval '20 days')`,[student]));
    assert.equal((await db.query('SELECT count(*)::int AS n FROM subscriptions WHERE user_id=$1',[student])).rows[0].n,1);
    await db.exec(`CREATE FUNCTION reject_notification() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fallo de aviso'; END $$;
      CREATE TRIGGER reject_notification BEFORE INSERT ON notifications FOR EACH ROW EXECUTE FUNCTION reject_notification();`);
    await assert.rejects(approve(db),/fallo de aviso/);
    assert.equal((await db.query('SELECT status FROM users_profiles WHERE id=$1',[student])).rows[0].status,'pending');
    const days=(await db.query(`SELECT round(extract(epoch FROM (end_date-start_date))/86400)::int AS n FROM subscriptions WHERE user_id=$1`,[student])).rows[0].n;
    assert.equal(days,20);
  } finally { await db.close(); }
});

test('nuevo registro requiere prueba privada y no crea una renovación por aprobar',async()=>{
  const db=await setup();
  try {
    const id=uid(4),path=`registration/${uid(22)}.pdf`;
    await asUser(db,null,()=>db.query(`INSERT INTO storage.objects(bucket_id,name) VALUES('payment_receipts',$1)`,[path]));
    await assert.rejects(db.query(`INSERT INTO auth.users(id,email) VALUES($1,'missing@test.invalid')`,[uid(5)]),/prueba de pago válida/);
    await db.query(`INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,'new@test.invalid',$2)`,[id,JSON.stringify({full_name:'Nuevo',payment_receipt_url:path})]);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM payments WHERE user_id=$1',[id])).rows[0].n,0);
    await asUser(db,admin,()=>db.query(`SELECT admin_set_user_status($1,'approved')`,[id]));
    assert.equal((await db.query('SELECT status FROM subscriptions WHERE user_id=$1',[id])).rows[0].status,'active');
  } finally { await db.close(); }
});

test('token cambia de cuenta y desvincular no elimina otras instalaciones',async()=>{
  const db=await setup();
  try {
    await asUser(db,student,()=>db.query(`SELECT register_push_device('phone','native')`));
    await asUser(db,student,()=>db.query(`SELECT register_push_device('laptop','web')`));
    await asUser(db,other,()=>db.query(`SELECT register_push_device('phone','native')`));
    assert.equal((await db.query(`SELECT user_id FROM user_push_devices WHERE fcm_token='phone'`)).rows[0].user_id,other);
    await asUser(db,other,()=>db.query(`SELECT unregister_push_device('phone')`));
    assert.deepEqual((await db.query('SELECT fcm_token FROM user_push_devices')).rows,[{fcm_token:'laptop'}]);
  } finally { await db.close(); }
});

test('progreso con esquema legado actualiza una sola pareja usuario/curso',async()=>{
  const db=await setup({legacyConfigs:true});
  try {
    await asUser(db,student,()=>db.query(`INSERT INTO course_student_configs(user_id,course_id,status,priority) VALUES($1,$2,'progress','high') ON CONFLICT(user_id,course_id) DO UPDATE SET status=EXCLUDED.status`,[student,uid(10)]));
    await asUser(db,student,()=>db.query(`INSERT INTO course_student_configs(user_id,course_id,status) VALUES($1,$2,'completed') ON CONFLICT(user_id,course_id) DO UPDATE SET status=EXCLUDED.status`,[student,uid(10)]));
    assert.deepEqual((await db.query('SELECT status,priority FROM course_student_configs')).rows,[{status:'completed',priority:'high'}]);
  } finally { await db.close(); }
});

test('migración se puede reaplicar y se detiene sin borrar suscripciones duplicadas',async()=>{
  const db=await setup();
  try {
    await db.exec(migration);
    await db.exec('DROP INDEX subscriptions_one_per_user');
    await db.query(`INSERT INTO subscriptions(user_id,status) VALUES($1,'pending')`,[student]);
    await assert.rejects(db.exec(migration),/suscripciones duplicadas/);
    await db.exec('ROLLBACK');
    assert.equal((await db.query('SELECT count(*)::int AS n FROM subscriptions WHERE user_id=$1',[student])).rows[0].n,2);
  } finally { await db.close(); }
});

test('publicación y notificación se confirman juntas; bonos individuales no se anuncian globalmente',async()=>{
  const db=await setup();
  try {
    await asUser(db,admin,()=>db.query(`INSERT INTO courses(title,drive_url) VALUES('Curso nuevo','https://example.invalid')`));
    await asUser(db,admin,()=>db.query(`INSERT INTO news_posts(title,content) VALUES('Aviso','Texto')`));
    await asUser(db,admin,()=>db.query(`INSERT INTO bonuses(title,is_global) VALUES('Bono individual',false)`));
    assert.equal((await db.query('SELECT count(*)::int AS n FROM notifications WHERE user_id IS NULL')).rows[0].n,2);
    await db.exec(`CREATE FUNCTION reject_content_notice() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fallo de publicación'; END $$;
      CREATE TRIGGER reject_content_notice BEFORE INSERT ON notifications FOR EACH ROW EXECUTE FUNCTION reject_content_notice();`);
    await assert.rejects(asUser(db,admin,()=>db.query(`INSERT INTO courses(title,drive_url) VALUES('Curso revertido','https://example.invalid')`)),/fallo de publicación/);
    assert.equal((await db.query(`SELECT count(*)::int AS n FROM courses WHERE title='Curso revertido'`)).rows[0].n,0);
  } finally { await db.close(); }
});
