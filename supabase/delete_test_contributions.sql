-- Opción 1: Eliminar SOLO los aportes que fueron rechazados o están pendientes (para limpiar pruebas fallidas)
DELETE FROM public.user_contributions 
WHERE status != 'approved';

-- Opción 2: Eliminar ABSOLUTAMENTE TODOS los aportes (si quieres limpiar por completo la comunidad)
-- Descomenta la siguiente línea si quieres borrar absolutamente todos los aportes de la base de datos:
-- TRUNCATE TABLE public.user_contributions;
