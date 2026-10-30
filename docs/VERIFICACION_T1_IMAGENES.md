# T1: entrega directa de imagenes Cloudinary

Fecha: 2026-10-29. Solo local; sin commit, push, despliegue ni cambio de plan.

## Implementacion

- SiteImage conserva next/image y selecciona un loader CDN solo para URLs HTTPS publicas, versionadas y sin firma/transformacion/query de la ruta mordida-tasty/images.
- Cloudinary recibe c_limit, ancho, calidad y f_auto. No se recorta, no se amplian originales pequenos y no se cambia la URL guardada en BD.
- Se aplica en producto, hero, marca y componentes del menu admin. Las previews explicitamente unoptimized siguen directas. QR de 2FA, blobs, imagenes locales y fuentes especiales mantienen su entrega anterior.
- Sin nuevas dependencias ni cambios de CSS, precios, descuentos, sesiones o subidas.
- remotePatterns revisado pero no restringido en esta entrega: el API admite imagenes previamente guardadas de otras rutas Cloudinary. No se dispone de inventario completo para bloquearlas sin riesgo. El endpoint optimizador sigue existiendo para fuentes no migradas; esta tarea reduce su uso normal, no elimina toda su superficie de carga.

## Verificacion

- Lint web: pasa.
- Build web: pasa (Next 16.4.2, build oOktrYPAtx2NhXgjTDdEg).
- image-delivery.spec.ts + promotion-pricing.spec.ts: 10 pruebas pasan, desktop y mobile.
- Smoke de subida de imagen y logos cuadrado/horizontal: 4 pruebas pasan, desktop y mobile.
- Segunda captura dirigida de entrega CDN: 2 pruebas pasan.
- Se comprueban URLs excluidas, variantes responsivas, naturalWidth positivo, fallback ante error, imagenes locales, precios promocionales y carrito.
- Los E2E usan API e imagenes CDN simuladas; no acreditan escrituras reales en Cloudinary/BD. Los logs del smoke contienen 404 del favicon por no existir API local de servidor y de una URL ficticia de hero; no se presentan como validacion de disponibilidad de esas rutas reales.
- Comprobacion adicional de red real, solo lectura: hero publico transformado responde 200 image/webp, 640x400, 41238 bytes; logo publico responde 200 image/webp, 512x512, 12340 bytes, hasAlpha=true. Esto verifica que las transformaciones necesarias estan disponibles en la cuenta actual y mantienen transparencia.
- Capturas con fixtures: audit-artifacts/t1-image-delivery/desktop.png y mobile.png. Se tomaron tras desplazar la pagina para cargar las imagenes; la cabecera sticky puede aparecer a mitad de la captura completa.

## Memoria y limites

La prueba posterior de produccion local completo 480 solicitudes sin errores:
audit-artifacts/memory-2026-10-29/1793300395579/summary.json.

| Escenario local, cuatro concurrentes | Antes | Despues |
| --- | ---: | ---: |
| Pico paginas | 114.3 MiB | 114.3 MiB |
| Pico transformaciones de fotos locales | 316.5 MiB | 315 MiB |
| Reposo final | 90.6 MiB | 90 MiB |

No hay ahorro significativo demostrado en ese escenario: las fotos locales siguen usando Next. El escenario CDN se verifico por red en Playwright: las imagenes compatibles usan src/srcset Cloudinary y hay cero solicitudes /_next/image para ellas. No se ha medido una reduccion de RSS de produccion con el catalogo real; faltan metrica Linux/Render y trafico comparable antes/despues. La medicion local posterior coincidio parcialmente con un servidor dev de E2E: el RSS muestreado es solo del proceso de produccion, pero los tiempos pueden verse afectados por competencia por CPU.

Las fotos locales no se han convertido y el favicon no se ha cambiado. T2 (retencion en limitador) y T3 (sondeo secuencial) siguen pendientes. El OOM de Render NO queda certificado como resuelto por estas pruebas.

Rollback futuro: restaurar imports next/image en los seis componentes afectados y retirar helper/wrapper. No se requiere revertir BD ni archivos subidos.
