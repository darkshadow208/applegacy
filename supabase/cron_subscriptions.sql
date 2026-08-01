-- Extensión necesaria para ejecutar tareas programadas en PostgreSQL
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Trabajo diario para verificar y expirar suscripciones
-- Se ejecutará todos los días a la medianoche (hora del servidor)
SELECT cron.schedule(
    'expire_subscriptions_job',
    '0 0 * * *',
    $$
    UPDATE public.subscriptions
    SET status = 'expired'
    WHERE end_date < NOW() AND status = 'active';
    $$
);
