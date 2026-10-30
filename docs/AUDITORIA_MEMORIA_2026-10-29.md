# Auditoria de memoria y rendimiento

Fecha: 2026-10-29. Revision de codigo: 5f89356. Sin cambios de plan, despliegue ni datos de clientes.

## Conclusion

El aviso aportado identifica agotamiento de memoria en mordida-tasty-web. El plan mostrado es de pago, 0.5 CPU / 512 MB. La afirmacion anterior de que la causa era un plan gratuito fue incorrecta.

Se reproduce un pico importante al optimizar imagenes en Next, pero NO se reproduce un OOM ni una fuga sostenida del frontend en estas pruebas cortas. No es valido atribuir definitivamente el incidente a Sharp sin correlacionar los logs y metricas del contenedor de Render.

Si se reproduce una retencion sin caducidad de claves en el almacenamiento del limitador de peticiones de la API. Es un problema distinto: API y web son procesos/servicios separados.

No se demuestra que sea necesario aumentar ambos servicios a 2 GB. Tampoco se garantiza todavia que 512 MB sean suficientes bajo carga real.

## Mediciones reproducibles

Entorno: Windows, Node 22.19.0, Next 16.4.2, build local de produccion aXC-3f9TJ2Mvv-Xrhw7b5. Se utilizo el build existente: no se certifica una reconstruccion nueva ni igualdad de variables con Render. Telemetria RSS, heap, memoria externa y buffers cada 100 ms, exclusivamente en el proceso Next de prueba. La instrumentacion no modifica el arranque real.

Cada ejecucion realiza 160 GET de paginas, 20 transformaciones sin cache previa (5 fotos locales copiadas a rutas temporales, cuatro anchos de 640 a 3840), 300 GET de imagenes cacheadas y 20 segundos de reposo. Las copias temporales se eliminan al finalizar; las entradas generadas en la cache local de Next quedan como artefactos de prueba. No se ejecuta carga contra produccion.

| Etapa | Concurrencia de imagenes 4 | Concurrencia de imagenes 8 |
| --- | ---: | ---: |
| Pico RSS paginas | 114.3 MiB | 114.8 MiB |
| Pico RSS imagenes sin cache | 316.5 MiB | 340.1 MiB |
| RSS final reposo | 90.6 MiB | 89.9 MiB |
| Solicitudes medidas | 480 | 480 |
| Errores HTTP / red | 0 | 0 |

En la segunda ejecucion: p95 paginas 14 ms; imagenes sin cache 5871 ms; imagenes cacheadas 30-36 ms. Estos tiempos son locales, no una estimacion de la CPU de Render.

Las paginas probadas son /, /admin, /admin/menu, /admin/reportes, /admin/clientes, /cuenta, /carrito y /checkout. Un GET del HTML no ejecuta los flujos autenticados ni las consultas del navegador. No se simulan pagos, pedidos ni correos reales.

Evidencias:

- audit-artifacts/memory-2026-10-29/1793274454612/summary.json (4 concurrentes).
- audit-artifacts/memory-2026-10-29/1793274561345/summary.json (8 concurrentes).
- samples.jsonl y server.log junto a cada resumen.
- La ejecucion 1793274369749 es INVALIDA para imagenes: el ensayo inicial agregaba un query string que Next rechazo con 400. No se incluye en las 960 solicitudes validas ni en las conclusiones sobre imagenes.

Comandos:

```powershell
node scripts/audit-web-memory.mjs
$env:AUDIT_IMAGE_CONCURRENCY='8'
node scripts/audit-web-memory.mjs
node scripts/audit-rate-limit-memory.cjs
```

## Hallazgos por prioridad

### P1. Carga de imagenes en el servidor web

Referencias: apps/web/next.config.ts (images), apps/web/components/product-image.tsx:20, apps/web/components/menu-client.tsx:157.

Las imagenes de Cloudinary pasan tambien por el optimizador de Next. Las cinco imagenes locales pesan aproximadamente 2-2.3 MiB cada una; bytes comprimidos no equivalen a RAM de procesamiento. La prueba reproduce picos de 316-340 MiB con estas imagenes locales. No se ha medido aun el corpus completo de fotos reales ni la retencion del asignador de memoria en Linux.

Accion propuesta: servir variantes responsivas de Cloudinary desde su CDN, conservar el diseno y fallback, y preparar las imagenes locales en tamanos adecuados. Limitar las fuentes externas a la cuenta/ruta prevista (actualmente res.cloudinary.com/** permite cuentas ajenas). No desactivar globalmente la optimizacion sin evaluar peso de descarga. Repetir medicion antes/despues y comparar la grafica real.

### P1. Retencion reproducida en el limitador de la API

Referencias: apps/api/src/app.module.ts (ThrottlerModule/ThrottlerGuard); node_modules/@nestjs/throttler/dist/throttler.service.js:26 y :54. Version instalada y fijada en lock: 6.5.0.

El almacenamiento en memoria decrementa contadores al caducar, pero no elimina las claves del Map. Reproduccion aislada con TTL reducido a 20 ms, sin trafico real:

```text
round 1: keysAfterExpiration=1000 pendingTimers=0 zeroHitEntries=1000
round 2: keysAfterExpiration=2000 pendingTimers=0 zeroHitEntries=2000
```

Cada identidad/ruta nueva puede dejar otra entrada durante la vida del proceso. Esto NO significa 2000 entradas nuevas en cada visita del mismo cliente. La prueba confirma retencion logica, no cuantifica su impacto actual en Render ni explica el OOM del servicio web.

Accion propuesta: verificar correccion compatible del proveedor o implementar almacenamiento con expiracion y limpieza acotadas. Mantener reglas de bloqueo, concurrencia y proteccion del login; no desactivar el limitador. No modificar directamente node_modules como solucion.

### P2. Solicitudes periodicas solapables

Referencias: apps/web/components/admin-kitchen-client.tsx:95, admin-orders-client.tsx:244, tracking-client.tsx:97; apps/web/lib/api.ts:60.

Cocina consulta cada 2 segundos; caja realiza tres solicitudes cada 8 segundos; seguimiento consulta cada 10 segundos. Se limpian los intervalos al desmontar, pero no hay exclusividad de solicitud en vuelo ni timeout general en api(). Si una respuesta tarda mas que el periodo se acumulan peticiones. Caja recarga tambien ajustes y dashboard, que consulta los pagos del dia. Las solicitudes van directamente a la API, no consumen memoria del servidor Next por estar la pantalla abierta.

Accion propuesta: sondeo secuencial, cancelacion al desmontar y reintento espaciado ante errores; separar ajustes de los datos operativos. Mantener alertas de cocina y renovacion de sesion. El seguimiento puede dejar de consultar en estados terminales.

### P2. Reportes y listas con memoria proporcional al historial

Referencias: apps/api/src/orders/orders.service.ts:595, :664, :686, :708, :1328; apps/api/src/admin-customers/admin-customers.service.ts:216 y :292.

Reportes cargan todos los pedidos y relaciones del rango antes de agregar en JS. El rango tiene validacion de fechas, pero no limite de extension. Historial personal no esta paginado. Cocina limita por estado, no por cantidad. CRM de invitados agrupa en BD, pero carga todos los grupos y ordena/pagina en memoria. CRM de registrados y detalle de pedidos si usan paginacion.

Son riesgos de picos al crecer los datos, no prueba de fuga. Accion: agregacion/paginacion en BD y limites de rangos acordados; no truncar pedidos activos silenciosamente. Requiere fixture de volumen y Postgres de prueba para medir consultas y comprobar totales exactos.

### P2. Ruta del favicon con buffers y esperas no acotadas por la aplicacion

Referencia: apps/web/app/brand-icon.png/route.ts:18, :37, :52.

Cada peticion que llega a Next consulta settings y descarga el PNG con no-store. No establece timeout propio. Comprueba Content-Length si existe, pero si no existe lee todo el cuerpo antes de comprobar el limite de 5 MiB. Cache-Control puede ayudar en navegador/CDN, pero no es una cache de origen ni coalescencia de solicitudes.

Accion: timeout, lectura con limite real por streaming y cache/revalidacion acotada del recurso publico. Preservar actualizacion desde admin y URL estable. No se ha reproducido un exceso de memoria en esta ruta con el logo real.

### P3. Recursos de audio del navegador

Referencia: apps/web/components/kitchen-alarm.tsx:22 y :39.

El AudioContext se reutiliza dentro del componente pero no se cierra explicitamente al desmontarlo. El intervalo si se limpia. Puede retener recursos del navegador al navegar repetidamente; no es una fuga del proceso Render. Accion: cierre del contexto y desconexion de nodos al finalizar su uso, sin silenciar alertas activas. Falta perfil de navegador prolongado para cuantificarlo.

## Otros procesos revisados

| Area | Resultado de inspeccion | Limite de la comprobacion |
| --- | --- | --- |
| Prisma | Servicio global y conexion reutilizada; no se encontro new PrismaClient por solicitud | No se midio pool ni SQL en Postgres real |
| Sesiones | Persistidas en BD; promesas de refresh se limpian con finally | Sin prueba de sesion larga en este ensayo |
| Menu/promos | Consultas a BD y transformaciones por solicitud, sin cache global creciente encontrada | Falta volumen de catalogo real |
| Subidas | Multer limita 10 MiB general y 5 MiB logos; buffer completo, logos validan pixeles | Multiples subidas simultaneas pueden sumar RAM en API |
| Correo | Transporte reutilizado; SMTP tiene timeouts y Brevo limpia su temporizador | No se enviaron correos |
| Pagos/checkout | Consultas dirigidas al pedido; no se encontro bucle persistente de servidor en el codigo revisado | No se ejecutaron transacciones Stripe ni concurrencia real |
| Alarmas/preview | Intervalos se limpian y object URLs de previews se revocan | Falta sesion de tablet de varias horas |
| Caché Next | Hay cache de framework y de imagenes, no evidencia de Map propio ilimitado en web | RSS local no incluye contenedor/caches de SO/npm; Linux difiere |
| Health API | SELECT 1 verifica BD | No prueba disponibilidad de todas las rutas |

## Pendiente para cerrar causa de produccion

No hay conexion autenticada disponible al servicio Render en esta sesion. Se encontro el conector Render en el catalogo, pero no esta instalado/conectado. Por tanto no se han consultado sus logs privados, uso real por proceso, limites efectivos ni eventos del OOM.

Se necesitan Memory/RSS y CPU de mordida-tasty-web y mordida-tasty-api durante el incidente, logs de los minutos anteriores y hora del aviso, junto con Start Command y variables de memoria (solo nombres/valores no secretos como NODE_OPTIONS). Comparar pico abrupto con crecimiento continuo. Una prueba corta en Windows no certifica estabilidad prolongada en Linux.

No se recomienda aumentar costes como primera conclusion de esta auditoria. Prioridad: eliminar el procesamiento redundante de imagenes, corregir retencion del limitador, controlar sondeo y medir otra vez. Si el servicio vuelve a caer durante ventas, ampliar temporalmente solo el servicio afectado puede dar margen, pero es una decision operativa, no una correccion demostrada.

## Referencias

- https://nextjs.org/docs/15/pages/guides/self-hosting (optimizacion de imagenes y memoria en Linux glibc).
- https://nextjs.org/docs/app/guides/self-hosting (cache de servidor).
- https://nextjs.org/docs/app/api-reference/components/image (limites de fuentes y cuerpo de imagen).
- https://render.com/docs/service-metrics (correlacion de metricas y logs).

Estado: auditoria local y estatica documentada. No hay correcciones funcionales, commit, push o despliegue en esta tarea. Los scripts de prueba terminan su proceso Next al finalizar.
