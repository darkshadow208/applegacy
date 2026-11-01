# Correcciones de acceso y aprobación manual

## Flujo conservado

1. El alumno sube una prueba de pago privada durante el registro.
2. La cuenta queda pendiente. El registro no crea una renovación pendiente.
3. El administrador abre el comprobante con una URL temporal y aprueba la cuenta.
4. Una transacción aprueba la cuenta, activa 30 días y registra el comprobante inicial como revisado. Repetir esa aprobación no concede más días.
5. Los comprobantes siguientes son solicitudes de renovación. Enviarlos o rechazarlos conserva los días ya aprobados; solo la aprobación manual del administrador agrega 30 días, una vez.

No se añade ninguna pasarela ni confirmación automática de pago. React llama funciones SQL autenticadas después de la acción del administrador. Rehabilitar una cuenta suspendida conserva sus fechas; no regala otro periodo. Para otorgar acceso adicional, el administrador puede revisar una renovación o editar las fechas explícitamente.

## Activación en Supabase

Los cambios del cliente necesitan la migración `supabase/migrations/202611010001_manual_approvals_security.sql`. **No fue aplicada a la base remota desde este trabajo.**

1. Usar primero un entorno de staging y una copia de seguridad del entorno que se vaya a actualizar.
2. Comprobar duplicados con las consultas de abajo y reconciliar las fechas correctas si existen. La migración aborta y revierte todo si encuentra duplicados; no elige ni borra suscripciones automáticamente.
3. Aplicar la migración completa en una única ejecución con el propietario administrativo de la base, sobre el esquema existente y las tablas del plan de estudio. No ejecutarla por fragmentos.
4. Publicar el cliente y regenerar/sincronizar el APK. Coordinar el cambio para evitar que un cliente antiguo intente las escrituras que ahora requieren RPC. Cerrar temporalmente registro y revisión durante esa transición si hay usuarios activos.
5. Verificar registro real, aprobación manual, apertura de comprobante (imagen/PDF), renovación anticipada, rechazo y cierre de sesión en web/Android.

```sql
select user_id, count(*) from public.subscriptions
group by user_id having count(*) > 1;

select user_id, course_id, count(*) from public.course_student_configs
group by user_id, course_id having count(*) > 1;
```

No volver a ejecutar los SQL históricos `update*.sql`, `rls_policies.sql` ni `fix_security_and_rls.sql` después de esta migración: son snapshots anteriores y pueden redefinir funciones/permisos. La migración nueva es la fuente de las reglas actuales. `update.sql` también fue ajustado para no declarar comprobantes públicos ni volver a abrir perfiles completos.

## Cambios de datos y permisos

- Se retiran todas las políticas anteriores de cursos, bonos, perfiles, suscripciones, pagos y aportes antes de instalar las nuevas. Premium exige perfil aprobado y fechas vigentes del servidor; admite el rol administrativo.
- La comunidad usa una vista de tres columnas (`id`, `full_name`, `avatar_url`). El resto del perfil solo es visible para su dueño y administradores.
- `payment_receipts` se vuelve privado con límite de 5 MB y tipos permitidos. La subida anterior al registro conserva la ruta anónima `registration/<uuid>.<ext>`; solo el administrador puede leer ese archivo inicial. Las renovaciones usan `<user_id>/<uuid>.<ext>` y las puede leer su propietario o el administrador. Las URLs públicas históricas se convierten a rutas al abrirlas; no es necesario volver a subir esos archivos.
- Los comprobantes se abren con firmas de 120 segundos. Un modal abierto durante más tiempo puede necesitar cerrarse y abrirse otra vez. Los PDF se muestran en un visor o enlace separado.
- `first_approved_at` distingue altas de reactivaciones; `payments.purpose` distingue registro y renovación. Los datos históricos se clasifican por la nota del registro o la coincidencia con el comprobante del perfil. Revisar manualmente historiales que ya fueran inconsistentes; la migración no revoca días concedidos anteriormente por error.
- La migración restaura el estado activo/expirado de suscripciones históricas `pending_renewal` según sus fechas existentes. También impide al cliente, incluso al admin, escribir directamente en suscripciones y revisar pagos fuera de las RPC.
- Las RPC administrativas validan rol, bloquean filas y confirman aprobación, fechas y notificación dentro de la misma transacción. Repetir una decisión no extiende otra vez; una decisión contradictoria sobre un registro ya revisado devuelve error.
- Los pagos propios solo se insertan pendientes y con un comprobante privado perteneciente al solicitante; los aportes propios solo pueden entrar pendientes, salvo administración.
- El progreso del detalle y el plan comparten `course_student_configs`, con conflicto explícito por usuario y curso. Los rechazos se muestran al usuario; el plan recarga el estado confirmado si falla una escritura optimista.
- Los avisos de contenido se crean con triggers para evitar confirmar publicación sin su aviso; los avisos de aportes ya no requieren consultar perfiles privados de administradores.
- El cierre de sesión desvincula la instalación actual con la sesión aún válida, retira listeners y cancela recordatorios. Un fallo de red al desvincular se informa y deja reintentar antes de cerrar. No se eliminan los dispositivos de otras instalaciones de la misma cuenta.
- Tokens nuevos se registran en `user_push_devices`, con un único dueño por token. Se limpian asociaciones duplicadas antiguas conservando la más reciente. El token antiguo del perfil se limpia al registrar/desvincular esa instalación.
- Los IDs de avisos inmediatos caben en un entero de 32 bits. El efecto de push depende de la identidad/rol, no de cada modificación del perfil o XP. Los callbacks viejos se descartan aunque terminen después del cierre.

## Verificación

`npm test` ejecuta pruebas con PostgreSQL local en PGlite y pruebas del cliente con HTTP simulado, sin conectar a Supabase ni usar credenciales reales. Cubren autorización, privacidad, transacciones, reintentos, renovación, progreso, enlaces firmados y carreras del registro push. `npm run build` comprueba TypeScript y el empaquetado.

Resultado local: 17 pruebas aprobadas y build correcto. Los archivos nuevos y pruebas no tienen errores de ESLint; el lint global todavía falla por deuda previa de tipos/hooks en el proyecto. Sigue la advertencia de tamaño del bundle.

No sustituye la verificación de Storage, Auth, Realtime y plugins en el despliegue real. La función Edge de envío FCM y el aviso crítico de la dependencia Android del informe inicial siguen siendo trabajos separados; esta corrección del ciclo de vida de notificaciones no debe interpretarse como cierre de esos otros hallazgos.
