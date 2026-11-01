# Auditoría de Legacy App

Fecha: 1 de noviembre de 2026. Revisión del checkout `b35885d`, inicialmente sin cambios pendientes.

## Dictamen y alcance

La aplicación tiene sus módulos principales implementados y compila, pero requiere corregir autorización, privacidad e integridad de suscripciones antes de considerarla lista para producción. El mayor riesgo está en las reglas del servidor y en operaciones de negocio repartidas entre varias peticiones del cliente.

Se revisaron rutas, autenticación, páginas de usuario, administración, hook de estudio, notificaciones, SQL, dependencias, configuración Android y CI. Se ejecutaron build, lint, consulta de vulnerabilidades y comprobaciones locales de configuración. No se modificó código funcional, no se ejecutaron scripts de limpieza ni SQL, no se accedió a datos de usuarios y no se probó un APK en dispositivo. Esta es una auditoría del repositorio, no una certificación ni una prueba de penetración del despliegue.

Las políticas descritas son las que contienen los archivos. Su explotación en producción depende de cuáles estén realmente aplicadas, de los privilegios SQL, de la configuración del gateway y de posibles cambios manuales no versionados. Los escenarios de reproducción siguientes son para un entorno de pruebas; no se ejecutaron contra producción.

## Lógica y arquitectura

- React 19 + TypeScript + Vite; React Router organiza autenticación, área de alumno y administración. Zustand mantiene sesión, perfil y contador de notificaciones.
- El navegador consulta Supabase directamente usando la clave pública. Por ello, RLS, restricciones y funciones SQL son la frontera de seguridad; `ProtectedRoute` controla navegación, pero no autoriza consultas directas.
- Registro: se sube primero un comprobante sin sesión; `signUp` envía nombre, contacto, fecha y URL en metadatos. El trigger crea perfil pendiente, suscripción pendiente y, según la versión instalada de la función, pago inicial pendiente.
- Aprobación: el administrador cambia el perfil a aprobado y activa una suscripción. La revisión de pagos es otra acción que extiende la fecha 30 días. Estas acciones no forman una transacción compartida.
- Cursos y bonos entregan enlaces externos a Drive. La app organiza acceso y seguimiento; no contiene un reproductor con progreso verificable ni administra los permisos de Google Drive.
- Comunidad: aportes de alumnos pendientes y moderación administrativa. Los archivos se suben al bucket público de avatares.
- Estudio: metas, tareas, hábitos, preferencias y configuraciones de cursos en tablas por usuario. Parte del detalle de curso usa únicamente almacenamiento local. El cliente solicita las recompensas XP.
- Notificaciones: tabla con mensajes personales/globales, Realtime, avisos locales de Capacitor, Firebase Web y función Edge que envía FCM usando una cuenta de servicio.
- Android empaqueta `dist` con Capacitor; CI genera un APK debug. No hay backend tradicional aparte de SQL y la función Edge.

## Validaciones ejecutadas

| Comprobación | Resultado |
| --- | --- |
| `npm run build` | Pasa TypeScript y Vite. Bundle principal de 1.030,15 kB, 280,36 kB gzip; advertencia por tamaño. |
| `npm run lint` | Falla: 125 problemas, 120 errores y 5 advertencias. Incluye `any`, hooks, bloques vacíos y variables sin uso. |
| `npm audit --json` | 35 entradas afectadas: 3 críticas, 17 altas y 15 moderadas. Consulta autorizada por el usuario. Resultado completo en `auditoria-npm-2026-11-01.json`. |
| Comparación de dependencias | `@capacitor/android` 8.5.0 está en el rango crítico del aviso del fabricante. Hay `tar` 6.2.1 anidado en assets además de `tar` 7.5.22 en la raíz. |
| Tipado | `strict` no está habilitado; no hay tipos de base de datos generados para el cliente. La función Edge usa `@ts-nocheck` y no entra en el build de la aplicación. |
| PWA | `dist/index.html` no enlaza el manifiesto. Los siete iconos referenciados no están bajo sus rutas web en `dist`. |
| Notificaciones Android | `Date.now()` excede el rango de entero Java de 32 bits exigido por el plugin instalado. |
| Pruebas | No hay script de pruebas de aplicación ni suite frontend/SQL. Los tests Android presentes son ejemplos del scaffold. |

El resultado de npm cuenta paquetes afectados, incluyendo dependencias transitivas y de desarrollo; no equivale a 35 fallos explotables desde el navegador. No se aplicó `npm audit fix`: algunas sugerencias implican cambios mayores o retrocesos de versión y necesitan evaluación.

## Hallazgos prioritarios

Prioridad: P0 = atender inmediatamente antes de distribuir; P1 = alto impacto; P2 = fiabilidad o funcionalidad; P3 = mejora de calidad. La prioridad del repositorio no implica que el fallo ya esté explotado.

### 01 · P0 · Dependencia Android con vulnerabilidad crítica confirmada

**Evidencia:** `package-lock.json:307` fija `@capacitor/android` en 8.5.0. `npm audit` y el [aviso oficial de Capacitor](https://github.com/ionic-team/capacitor/security/advisories/GHSA-rvm3-566m-v7fv) incluyen esa versión y señalan 8.5.1 como parche para su rama.

**Impacto:** navegación a una ruta interna puede cargar contenido remoto con confianza del origen de la app; requiere interacción del usuario con un enlace. La comunidad y los enlaces administrables merecen revisión como superficies posibles. No se ejecutó una explotación.

**Corrección:** actualizar a una versión corregida compatible, sincronizar Android, reconstruir y redistribuir el APK; validar destinos de enlaces. Eliminar solo el uso explícito de CapacitorHttp no basta según el fabricante. Las otras dos entradas críticas de npm corresponden a herramientas de desarrollo: Handlebars y tar anidado.

### 02 · P1 · Las reglas nuevas de suscripción no anulan las antiguas

**Evidencia:** `supabase/schema.sql:213` permite leer cursos activos a cualquier autenticado; `supabase/update.sql:48` hace lo mismo con bonos activos. `supabase/rls_policies.sql:13` y `:32` añaden reglas por suscripción sin retirar esas reglas amplias. `fix_security_and_rls.sql` tampoco las retira.

**Impacto:** con ambas versiones aplicadas, un usuario pendiente, suspendido o sin pago puede seguir consultando contenido activo directamente, incluidos enlaces cuando solicita esa columna. Las políticas permisivas se combinan con OR, como explica [PostgreSQL](https://www.postgresql.org/docs/17/ddl-rowsecurity.html).

**Validación:** en staging, consultar cursos y bonos usando tokens de esos tres estados. **Corrección:** sustituir las reglas antiguas y centralizar una condición de acceso que exija perfil aprobado y suscripción vigente, con excepción administrativa explícita.

### 03 · P1 · Los comprobantes permanecen en un bucket público

**Evidencia:** `supabase/update.sql:21` fuerza `payment_receipts.public = true`. El endurecimiento reemplaza políticas de lectura pero no cambia ese atributo. `Register.tsx:54` y `Subscription.tsx:83` generan URLs públicas; los modales de administrador las usan directamente.

**Impacto:** quien tenga la URL puede leer el comprobante si esa configuración está aplicada. En buckets públicos, servir el archivo evita el control RLS de lectura, según [Supabase](https://supabase.com/docs/guides/storage/buckets/fundamentals). Volverlo privado sin cambiar el cliente rompería la visualización actual.

**Corrección:** bucket privado, guardar rutas y generar URLs firmadas cortas tras autorizar al solicitante. Diseñar la subida inicial con una autorización temporal y límites del servidor; las subidas previas al registro tienen propietario anónimo y no quedarían accesibles al alumno mediante `auth.uid() = owner`.

### 04 · P1 · Lectura de perfiles completos por cualquier autenticado

**Evidencia:** `supabase/update.sql:38` permite SELECT de cualquier fila de `users_profiles`. La tabla reúne correo, teléfono, Telegram, comprobantes y, con migraciones posteriores, token FCM y preferencias de notificaciones.

**Impacto:** la necesidad de mostrar nombre/avatar en comunidad termina permitiendo solicitar columnas privadas de otros alumnos. Una selección reducida en React no limita lo que puede solicitar otro cliente.

**Corrección:** separar el perfil público mínimo del privado y revisar permisos por columna/vistas con su contexto de seguridad. No basta añadir una segunda política de lectura más estricta mientras permanezca la amplia.

### 05 · P1 · La función de envío push carece de autorización propia

**Evidencia:** `supabase/functions/push-notification/index.ts:12` procesa el body, acepta `record || payload` y usa `SUPABASE_SERVICE_ROLE_KEY` sin validar identidad, rol ni secreto de webhook. Omitir `user_id` elige el envío global.

**Impacto:** si el gateway permite invocación con un JWT de alumno, ese alumno puede pedir envíos arbitrarios con privilegios de servicio; si se desactiva la verificación JWT, también podría hacerlo un anónimo. La configuración desplegada no está versionada y no se verificó.

**Corrección:** comprobar JWT y rol para llamadas administrativas o autenticar un webhook de servidor; verificar el registro en base de datos y aplicar límites, auditoría e idempotencia. CORS no sustituye autorización.

### 06 · P1 · Pagos y aportes pueden insertarse como aprobados

**Evidencia:** `supabase/schema.sql:217` y `:223` solo verifican que `user_id` sea el propio; no fuerzan `status = 'pending'`. No hay trigger de protección de esos estados en los SQL revisados.

**Impacto:** un cliente puede insertar un aporte aprobado y saltarse moderación, o un pago aprobado y falsear el historial. Insertar un pago aprobado no activa por sí solo la suscripción en el código actual.

**Corrección:** forzar estados iniciales en servidor, validar importe/fecha/comprobante y reservar transiciones a operaciones administrativas. Probar solicitudes directas, no solo el formulario.

### 07 · P1 · Suscripciones duplicadas al editar fechas

**Evidencia:** `AdminUsers.tsx:176` usa `upsert` sin `id` ni `onConflict`. `supabase/schema.sql:36` no tiene unicidad de `user_id`; la clave primaria es un UUID con default. Otros módulos leen la suscripción mediante `maybeSingle()`.

**Impacto:** editar fechas de una suscripción existente puede insertar otra en vez de actualizarla; las consultas que esperan una sola fila dejan de funcionar. Añadir únicamente un UNIQUE sin corregir el upsert cambiaría el síntoma por un error de conflicto.

**Corrección:** decidir si el modelo es una suscripción por usuario o historial de suscripciones; deduplicar con una regla explícita y usar UPDATE por id o UPSERT con conflicto correcto. El acceso y las estadísticas deben consultar la misma definición de suscripción vigente.

### 08 · P1 · Contrato SQL incompleto y migraciones dependientes del orden

**Evidencia:** `AdminApprovals.tsx:138` y `AdminUsers.tsx:181` escriben `plan_name`, columna ausente en todos los SQL del repositorio. `study_goals` existe con y sin `subtasks`; `course_student_configs` existe con UUID primario o clave compuesta; los perfiles de estudio difieren en tipos. `CREATE TABLE IF NOT EXISTS` no adapta tablas existentes.

**Impacto:** una instalación reproducida desde estos archivos puede fallar al aprobar usuarios, perder subtareas o crear configuraciones duplicadas al hacer upsert. Si `update.sql` creó primero los configs, sus upserts sin conflicto compuesto no coinciden con el UUID primario. También hay funciones redefinidas y políticas no idempotentes.

**Corrección:** migraciones numeradas con ALTER explícitos y estado base verificable. Ensayar creación desde cero y actualización de una base previa. No ejecutar todos los archivos alfabéticamente: `update.sql` mezcla configuración con datos de prueba y creación de un administrador con credenciales de ejemplo.

### 09 · P1 · Aprobaciones sin transacción ni protección contra repetición

**Evidencia:** `AdminApprovals.tsx:116` actualiza primero perfil y después suscripción; `:175` actualiza primero pago y después suscripción/notificación. El update de suscripción en revisión de pago no comprueba el error. No hay condición de estado anterior ni bloqueo de acciones durante la petición.

**Impacto:** un fallo intermedio deja una cuenta aprobada sin acceso o un pago aprobado sin extenderlo. Dos administradores o un reintento pueden repetir la extensión o perder una actualización concurrente.

**Corrección:** RPC transaccional con validación de admin, bloqueo de filas, transición condicional de pendiente a revisado, resultado comprobable e idempotencia. Probar fallo parcial, doble clic y revisión concurrente del mismo pago.

### 10 · P1 · Un mismo comprobante inicial puede otorgar dos periodos

**Evidencia:** `schema.sql`, función `handle_new_user`, crea un pago inicial pendiente. `AdminApprovals.tsx` activa un mes al aprobar el perfil y muestra también ese pago en la cola de pagos pendientes. Aprobarlo añade otros 30 días.

**Impacto:** revisar las dos colas del mismo registro puede conceder aproximadamente dos meses por un solo pago. El orden contrario puede sobrescribir la fecha; aprobar solo el pago deja el perfil pendiente.

**Corrección:** ligar aprobación inicial, comprobante, pago y activación en una operación única; identificar el motivo de cada pago y evitar procesarlo como renovación. Unificar la duración: actualmente el alta suma un mes de calendario y la renovación suma 30 días.

### 11 · P1 · Renovar anticipadamente interrumpe la membresía vigente

**Evidencia:** `Subscription.tsx:102` cambia siempre a `pending_renewal`, aunque el comentario diga que solo es para expiradas. La regla de lectura por suscripción exige `status = 'active'`. Rechazar el pago no restaura el estado anterior.

**Impacto:** un alumno que aún tiene días pagados puede perder acceso al solicitar renovación, en cuanto se corrijan las políticas permisivas del hallazgo 02.

**Corrección:** mantener la vigencia del derecho de acceso independiente del estado del pago. Una solicitud pendiente o rechazada no debe cancelar días ya comprados. Probar renovación anticipada aprobada y rechazada.

### 12 · P1 · La vigencia y la suspensión no se exigen en las reglas de contenido

**Evidencia:** `supabase/rls_policies.sql:19` y `:40` solo comprueban estado activo, sin `end_date > now()`, fecha de inicio ni perfil aprobado. `cron_subscriptions.sql` expira estados una vez al día; suspender un perfil no cambia necesariamente la suscripción.

**Impacto:** aun retirando las reglas amplias, una suscripción vencida puede dar acceso hasta la siguiente ejecución del cron; un alumno suspendido puede conservar acceso directo si su suscripción sigue activa.

**Corrección:** resolver autorización con hora del servidor y estado del perfil en cada lectura sensible. El cron debe ayudar a mantener estados, no ser la única barrera de vencimiento.

### 13 · P2 · La política de renovación permite alterar fechas y otros campos

**Evidencia:** `fix_security_and_rls.sql:35` exige usuario propio y estado final pendiente, pero no limita cambios a `payment_receipt_url` y estado.

**Impacto:** el alumno puede modificar `start_date` y `end_date` mientras solicita renovación. No se convierte directamente en activo con esa política, pero el administrador calcula la extensión desde el `end_date` existente (`AdminApprovals.tsx:189`); podría validar una fecha manipulada sin advertirlo.

**Corrección:** permitir solo una RPC de solicitud o proteger columnas y transiciones; calcular el periodo aprobado desde datos que solo controle el servidor.

### 14 · P2 · XP manipulable, incluso con el endurecimiento

**Evidencia:** la política de UPDATE del perfil permite cambiar columnas propias; el trigger protector solo revisa rol y estado (`fix_security_and_rls.sql:11`). `add_user_xp` permite al dueño solicitar repetidamente hasta 200 XP por llamada, sin asociarlo a una acción única.

**Impacto:** es posible modificar directamente XP o solicitar premios repetidos. Además, `StudyPlan.tsx:84` modifica XP local sin inspeccionar el error RPC, y puede mostrar resultados distintos al servidor.

**Corrección:** impedir escritura directa de XP; otorgarlo por eventos comprobados y únicos en una transacción de servidor. Conservar un registro de premios si XP tendrá valor competitivo o económico.

### 15 · P2 · Errores de escritura ocultos y mensajes de éxito falsos

**Evidencia:** `Profile.tsx:95`, `:98`, `:135`; numerosos handlers de `StudyPlan.tsx`; `Subscription.tsx:102`; notificaciones administrativas. Esperan la llamada, pero no inspeccionan `{ error }`. Un `try/catch` no detecta por sí solo errores devueltos en ese campo.

**Impacto:** se muestra contraseña/perfil guardado, progreso completado o renovación enviada aunque el servidor haya rechazado parte de los cambios. Se pierde información al recargar y no hay rollback coherente.

**Corrección:** comprobar cada resultado o usar `throwOnError`, verificar filas afectadas, revertir el estado optimista y mostrar un error útil con reintento. Centralizar mutaciones para evitar repetir el defecto.

### 16 · P2 · El detalle de curso y el plan guardan progreso en sitios distintos

**Evidencia:** `CourseDetail.tsx:84` solo actualiza `localStorage`; `useStudyPlan.ts:54` carga `course_student_configs` del servidor. El plan no recupera ese progreso local al montar.

**Reproducción:** marcar un curso real como completado en su detalle y abrir el plan o iniciar sesión en otro dispositivo. El estado no coincide.

**Corrección:** una única fuente de progreso en Supabase con caché por usuario y sincronización explícita; ambos componentes deben consumir la misma mutación.

### 17 · P2 · Datos ficticios y cachés persistentes ocultan fallos reales

**Evidencia:** `Courses.tsx:29` y `Bonuses.tsx:28` cargan cachés globales; ante error o respuesta vacía mantienen caché o muestran mocks. El cache de bonos incluye la URL de descarga. `CourseDetail.tsx:166` puede sustituir un UUID inexistente por el primer curso ficticio y conserva curso previo si hay estado optimista.

**Impacto:** una cuenta puede ver datos almacenados por otra, seguir viendo bonos retirados o encontrar botones con `#`. Un permiso denegado se confunde con una app funcional. El catálogo escribe localStorage y el detalle intenta leer sessionStorage.

**Corrección:** retirar mocks del flujo productivo, diferenciar vacío/error/sin permiso/offline, aislar y expirar caché por usuario, invalidarla ante respuestas vacías y cerrar sesión. Una caché nunca debe validar autorización.

### 18 · P2 · La protección de rutas permite entrar sin perfil válido

**Evidencia:** `authStore.ts:37` ignora error de perfil y puede publicar sesión con perfil nulo. `App.tsx:69` solo bloquea dos estados explícitos; perfil ausente pasa en las rutas de alumno. La sesión/perfil no se vuelve a validar por cambios administrativos en tiempo real.

**Impacto:** fallos de perfil dejan acceder a la interfaz y la suspensión/aprobación puede verse tarde. El riesgo sobre datos depende de RLS y se combina con los hallazgos 02/12.

**Corrección:** distinguir sesión cargando, perfil cargando, error, pendiente y aprobado; permitir acceso solo con estado válido, y refrescar el perfil tras cambios pertinentes. Mantener el control de servidor independiente.

### 19 · P2 · Recuperación de contraseña sin recorrido dedicado

**Evidencia:** `Login.tsx:36` envía el correo con `resetPasswordForEmail`, pero no hay ruta de recuperación ni manejo de `PASSWORD_RECOVERY`; la única edición de contraseña está en el perfil protegido.

**Impacto:** un usuario puede llegar al dashboard sin indicación para completar la recuperación; pendientes o suspendidos pueden quedar sin acceso al formulario. El comportamiento concreto del enlace depende del Site URL configurado en Supabase.

**Corrección:** ruta de recuperación accesible al recibir la sesión de recuperación, formulario explícito, validación y mensaje de éxito. Probar enlace usado, vencido y cuenta pendiente; verificar redirect URLs en el entorno desplegado.

### 20 · P1 · El cierre de sesión no desvincula el dispositivo push

**Evidencia:** `authStore.ts:71` solo cierra Auth y vacía el store. No elimina el token de `user_push_devices`/perfil, listeners nativos, recordatorios o intervalo web. La función Edge envía a todos los dispositivos asociados.

**Impacto:** un teléfono compartido puede seguir recibiendo mensajes personales de la cuenta anterior; al usarlo con otra cuenta el mismo token puede quedar asociado a ambas. Los callbacks antiguos también retienen el userId previo.

**Corrección:** desvincular el dispositivo antes de terminar la sesión, gestionar la propiedad de tokens, retirar listeners y cancelar recordatorios por usuario. No borrar los dispositivos de otras instalaciones del mismo usuario.

### 21 · P2 · Registro nativo repetido y notificaciones locales con id inválido

**Evidencia:** `notifications.ts:36` registra push antes de añadir el listener de registro. `App.tsx:151` vuelve a ejecutar el efecto al cambiar todo el objeto perfil, por ejemplo al sumar XP; los listeners agregados no se eliminan. `notifications.ts:159` usa timestamp como id predeterminado.

**Impacto:** se puede perder el primer evento de token y acumular callbacks. El plugin Android instalado rechaza IDs fuera de entero de 32 bits; el timestamp actual supera ese rango, por lo que los avisos locales inmediatos del Realtime fallan.

**Corrección:** registrar listeners antes de `register`, inicializar por identidad/dispositivo, conservar handles para cleanup y usar IDs enteros acotados sin colisiones. Verificación local del límite también coincide con la [documentación del plugin](https://next.capacitorjs.com/docs/apis/local-notifications).

### 22 · P2 · Recordatorios y entrega push con estados incorrectos

**Evidencia:** `notifications.ts:195` deduplica recordatorios web con `HH:mm`, sin fecha; con un solo horario, al día siguiente se considera ya notificado. `:337` usa un lock global para vencimientos que no se reinicia al cambiar usuario/renovar/error. El servicio Edge ignora fallos de cada envío y responde `success: true` con todos los tokens contados.

**Impacto:** avisos que dejan de llegar y métricas que afirman entregas fallidas. La rama con más de tres días programa un aviso, pero no todos los recordatorios futuros. El contador Realtime aumenta, aunque la lista de la página no se actualiza en vivo ni se sincronizan todos los cambios de lectura de otro dispositivo.

**Corrección:** claves de deduplicación con usuario, fecha y evento; recalcular al renovar; gestionar entregas/reintentos y retirar tokens inválidos; consultar estados consistentes de notificaciones. El recordatorio web por intervalo solo funciona mientras la página está activa.

### 23 · P2 · Subidas abiertas y archivos de comunidad públicos antes de moderación

**Evidencia:** `fix_security_and_rls.sql:76` permite insertar recibos con extensión admitida sin exigir sesión ni límite de tamaño; `update.sql:25` permite subir a avatares sin propietario autenticado. `Contribute.tsx:62` usa ese bucket público para aportes, sin controles equivalentes de tamaño/tipo. El registro sube antes de `signUp` y no limpia si falla.

**Impacto:** abuso de almacenamiento, archivos huérfanos y acceso directo al archivo pendiente/rechazado si se conoce su URL. Los 5 MB del formulario no son una barrera del servidor. `AdminCommunity.tsx:62` intenta borrar objetos sin una política DELETE de storage para administradores en los archivos revisados y omite ese error.

**Corrección:** buckets separados por finalidad, límites MIME/tamaño del servidor, permisos de propietario y administración, cuarentena privada y limpieza de huérfanos. El borrado de filas y archivos requiere una estrategia consistente con reintentos.

### 24 · P2 · Riesgos operativos de instalación y distribución

**Evidencia:** `.github/workflows/build-apk.yml:25` solo ejecuta build, no lint/tests; vuelve a instalar Android tras `npm ci` y oculta cualquier fallo de `cap add` con `|| true`. Produce `assembleDebug`. El cliente acepta configuración ausente con placeholders (`src/lib/supabase.ts`). Los SQL incluyen instrucciones de bootstrap de administrador y scripts de borrado amplios.

**Impacto:** una compilación verde puede producir un APK sin backend válido, dependencias distintas del lock o sin validación de negocio. El script `supabase/delete_test_contributions.sql` elimina todos los aportes no aprobados, que pueden ser reales.

**Corrección:** configuración obligatoria y comprobada por entorno, instalación reproducible, CI de calidad y pruebas de negocio, APK release firmado cuando corresponda, separar migraciones de seed y mantenimiento. Evitar ejecutar scripts correctores de texto sobre el código como proceso de actualización habitual.

## Mejoras adicionales de producto y mantenimiento

- **Tipos y arquitectura:** generar tipos de Supabase, habilitar `strict` por fases y extraer servicios/hooks para acceso a datos. React Query ya está instalado pero no utilizado; evaluar usarlo para caché, invalidación y mutaciones en vez de los timeouts manuales repetidos.
- **Sesión:** el listener async consulta perfil para todos los eventos y retrasa la publicación de sesión. Desacoplar la consulta, controlar respuestas obsoletas y representar errores. No se declara un deadlock confirmado: el SDK instalado documenta que algunos patrones históricos ya fueron corregidos y quedan riesgos específicos de refresh anidado; la receta antigua de Supabase no basta para demostrarlo aquí.
- **Pruebas de seguridad:** añadir pruebas de RLS por rol/estado y RPC de negocio. El trigger de protección de rol/estado sí existe en el endurecimiento: verificar que esté instalado; sin él, la política de UPDATE propio permite autoasignación. Proteger también `search_path` y permisos de ejecución de funciones SECURITY DEFINER.
- **Base de datos:** índices para filtros frecuentes (`user_id`, estado, fechas) según planes reales; restricciones de importes, fechas y estados; política definida de `updated_at`. No hay mecanismo general visible que lo actualice en cada modificación.
- **Bonos individuales:** existen `user_bonuses` y bonos no globales, pero la pantalla filtra siempre `is_global = true`. Completar asignación y lectura autorizada; la regla restringida tampoco contempla el vínculo individual.
- **Categorías:** el catálogo usa una lista fija aunque administración crea categorías. Cargar las categorías reales para que las nuevas tengan filtro propio.
- **Estadísticas:** Analytics agrupa solo los últimos 1.000 perfiles y cuenta filas de suscripciones activas. Esto distorsiona el histórico y se agrava con duplicados/fechas vencidas. Agregar en SQL con límites temporales y significado de negocio explícitos.
- **Hábitos:** el cambio de día se calcula al cargar el hook; una pestaña abierta toda la noche conserva `completed_today`. Recalcular al recuperar foco y al cambiar fecha; evitar carreras entre dispositivos para rachas/XP.
- **Escala:** catálogos, pagos y notificaciones de alumno cargan todas las filas y luego filtran/paginan localmente o carecen de paginación. Añadir paginación del servidor y orden determinista; los límites API pueden truncar resultados silenciosamente.
- **Rendimiento:** usar importación diferida por ruta, especialmente administración y Recharts, y medir en un Android real. El bundle inicial supera 1 MB minificado porque las páginas se importan de forma estática.
- **PWA/accesibilidad:** enlazar manifiesto con nombre/start_url/display e iconos desplegados con MIME correcto; `index.html` declara inglés para interfaz española. Asociar labels/inputs, revisar botones solo con icono, foco de modales, teclado y tamaño de texto. La revisión fue de código; falta validación visual y con lector de pantalla.
- **Gestión de secretos:** hay una cuenta de servicio local ignorada por Git que contiene clave privada; no se imprimió su valor. No apareció en la historia accesible bajo ese nombre; `set-secret.cjs` sí aparece en historia. Esto no demuestra filtración. Mantener la clave fuera de entregables, limitar su acceso y rotarla si hubo exposición. `google-services.json` y la anon key pública no equivalen por sí mismos a claves administrativas.
- **Enlaces externos:** validar protocolo y destinos antes de guardar y abrir recursos, especialmente dentro del WebView. Los enlaces permanentes de Drive pueden seguir funcionando tras expirar la membresía si Drive permite acceso por enlace; comprobar permisos reales y decidir si se necesita entrega con autorización temporal.
- **Documentación:** sustituir el README de Vite por instalación, variables de entorno de ejemplo sin secretos, orden de migraciones, roles, aprobación/renovación, configuración Firebase, pruebas y distribución.

## Orden propuesto de corrección

1. Corregir y redistribuir Capacitor; verificar las políticas instaladas, el acceso a perfiles/comprobantes y la autorización de la función push.
2. Consolidar el esquema; resolver duplicados de suscripciones y configs; completar columnas antes de desplegar el cliente que las escribe.
3. Crear RPC transaccionales para alta, aprobación, renovación y cambios administrativos; separar pago pendiente de derecho de acceso; proteger estados/fechas/XP.
4. Unificar progreso/caché y manejar errores de todas las mutaciones; corregir recuperación de contraseña y estados de perfil.
5. Corregir ciclo de vida de tokens, listeners, IDs y recordatorios; probar dos cuentas y dos dispositivos.
6. Resolver dependencias por alcance y compatibilidad, activar CI con pruebas y lint, reducir bundle y completar documentación/PWA/accesibilidad.

## Criterios mínimos de aceptación

| Caso en staging | Resultado esperado |
| --- | --- |
| Usuario pendiente/suspendido/vencido consulta API directamente | Sin enlaces ni recursos premium. |
| Alumno consulta perfil de otro alumno | Solo campos públicos expresamente permitidos. |
| URL de comprobante sin autorización | Acceso denegado; propietario/admin pueden obtener acceso temporal. |
| Alumno invoca push global o inserta aporte/pago aprobado | Rechazado por servidor. |
| Editar fechas de suscripción dos veces | Sigue existiendo la cardinalidad prevista; no aparecen duplicados. |
| Aprobar un pago desde dos sesiones o repetir petición | Un solo periodo concedido. |
| Fallar a mitad de una aprobación | Rollback íntegro o reintento idempotente. |
| Renovar anticipadamente y rechazar el nuevo pago | Conserva acceso hasta su vencimiento ya pagado. |
| Marcar curso completado en detalle | Coincide en plan, recarga y segundo dispositivo. |
| Fallo RLS/red al guardar | No se confirma éxito; cambio local se revierte o queda pendiente explícitamente. |
| Salir de cuenta A y entrar a B en el mismo teléfono | Sin mensajes privados ni callbacks de A en B. |
| Recordatorio único dos días seguidos | Llega una vez cada día en plataforma compatible. |
| Instalar desde cero y migrar desde esquema anterior | Ambos terminan en el mismo contrato de datos y permisos. |

## Consultas de verificación del despliegue, solo lectura

Estas consultas no se ejecutaron. Permiten contrastar los hallazgos de SQL con una base de staging o con metadatos de producción usando un acceso administrativo autorizado.

```sql
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname in ('public', 'storage')
order by schemaname, tablename, policyname;

select id, public, file_size_limit, allowed_mime_types
from storage.buckets
where id in ('payment_receipts', 'avatars');

select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name in ('subscriptions', 'course_student_configs',
                    'study_goals', 'student_study_profile')
order by table_name, ordinal_position;

select user_id, count(*)
from public.subscriptions
group by user_id having count(*) > 1;

select user_id, course_id, count(*)
from public.course_student_configs
group by user_id, course_id having count(*) > 1;
```

Pendiente externo: comprobar metadatos desplegados, configuración JWT de Edge Functions, webhooks, cron/Realtime, URLs de recuperación, permisos Drive y comportamiento del APK. Nada de ello puede confirmarse solo con este checkout.
