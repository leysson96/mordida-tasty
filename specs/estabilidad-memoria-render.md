# Estabilidad de memoria: imagenes, limitador y sondeo

## Contexto

- Preparado el 2026-10-29. Alcance aprobado por el usuario: las primeras tres correcciones de la auditoria, primero en local.
- Base funcional: commit 5f89356. Estado actual: rama fix/search-brand-identity; hay documentos y artefactos ajenos pendientes que no deben incluirse ni revertirse.
- Fuente de evidencias: docs/AUDITORIA_MEMORIA_2026-10-29.md y sus JSON de medicion. OOM reportado en web, no en API. No asumir plan gratuito ni subida obligatoria de RAM.
- Stack existente: Next/React/TypeScript, Nest, Prisma y Cloudinary. Mantener convenciones de components/product-image.tsx, lib/api.ts y app.module.ts.
- Herramientas: apply_patch para cambios, Jest para politica del limitador, Playwright para red y comportamiento UI, scripts de auditoria para memoria del proceso de produccion local.
- No introducir una nueva plataforma, Redis ni librerias por defecto. Si se necesita actualizar una dependencia, comprobar primero documentacion oficial, version publicada, compatibilidad y lockfile; no actualizar todo el stack.
- Estado: T1, T2 y T3 implementados y verificados en local (docs/VERIFICACION_T1_IMAGENES.md, docs/VERIFICACION_T2_LIMITADOR.md y docs/VERIFICACION_T3_SONDEO.md). Sin commit/push/despliegue; ahorro de RSS en Render pendiente de medir.

## Objetivo

Reducir procesamiento de imagenes en el frontend, liberar entradas caducadas del limitador de la API y evitar sondeos solapados sin alterar pedidos, precios, sesiones ni alertas.

## Flujo

Secuencia del comportamiento aprobado:

```text
1. Navegador -> componente imagen: pide variante segun ancho.
2. Componente -> Cloudinary: solicita variante de una imagen publica admitida.
3. Cloudinary -> navegador: entrega imagen; Next no vuelve a transformarla.
4. Peticion API -> limitador: aplica las reglas actuales de conteo/bloqueo.
5. Limitador -> almacenamiento: libera solo estado definitivamente caducado.
6. Pantalla -> API: inicia una ronda de actualizacion.
7. Respuesta/error -> pantalla: actualiza o informa; programa siguiente ronda.
8. Desmontaje -> ronda: cancela trabajo pendiente y evita actualizaciones tardias.
```

Decisiones y casos borde:

```text
Imagen
  Cloudinary publico admitido? --si--> variante CDN con ancho/calidad
             | no
             +--> conservar ruta local/preview/fallback existente
  Error de carga --> fallback actual, sin cambiar URL guardada

Limitador
  Bloqueo vigente? --si--> rechazar como hasta ahora
         | no
         +--> contar atomicamente --> limite superado? --> bloquear
  Caducidad --> quedan hits o bloqueo vigentes?
                 si: conservar / no: eliminar estado y timers asociados

Sondeo
  Pantalla activa? --no--> cancelar solicitud y temporizador
         | si
  Ronda en curso? --si--> no iniciar otra
         | no
  Consultar --> exito: actualizar / error: mantener datos y avisar
  Programar siguiente ronda; una respuesta antigua no pisa filtros nuevos
```

## Restricciones

- Sin push, despliegue ni cambio de plan hasta aprobacion posterior. No solicitar otra aprobacion para decisiones locales reversibles dentro del alcance aceptado.
- Sin migraciones ni escrituras en la BD real; sin pedidos/pagos/correos reales de prueba.
- No modificar contrasenas, duracion de sesiones, reglas de efectivo, precios o descuentos.
- No reducir proteccion del login, cambiar limites del throttler ni borrar bloqueos vigentes para ahorrar memoria.
- No editar node_modules como arreglo.
- Evitar cambios visuales; conservar layout, transparencia del logo, relaciones de aspecto y fallbacks.
- Mantener la ruta del favicon y subidas desde admin sin cambios en esta fase.
- No imponer WSL/Docker al usuario. Distinguir mocks de validacion con BD real.
- No limitar ciegamente el heap de Node como sustituto de corregir la causa.

## Fuera de alcance

- Optimizacion SQL de reportes/CRM, limpieza de sesiones en BD, favicon y cierre del audio.
- Diseno nuevo, funcionalidades comerciales o cambios globales de dependencias.
- Garantizar que 512 MB bastan basandose solo en Windows. La confirmacion Linux/Render requiere metricas reales posteriores.

## Tareas

### T1: Imagenes desde Cloudinary

- **Hacer:** inventariar usos de next/image y separar fotos Cloudinary de assets locales, blobs y data URLs. Usar loader/helper compartido y pequeno para variantes CDN publicas; preservar URL almacenada. Aplicar la seleccion solo a fuentes compatibles. No alterar URLs firmadas o transformadas sin validacion explicita. Ajustar sizes donde falte y revisar remotePatterns para evitar optimizacion de cuentas ajenas sin bloquear archivos existentes.
- **Archivos:** apps/web/lib/ (helper de imagen), componentes con next/image (producto, hero, marca y previews segun necesidad), next.config.ts solo si corresponde, e2e/image-delivery.spec.ts (nuevo).
- **Herramientas:** API de loader de Next y transformaciones de Cloudinary documentadas oficialmente; Playwright inspecciona srcset y solicitudes. No hace falta otra libreria para construir URLs.
- **Assets locales:** cualquier conversion se realiza de forma mecanica y reversible conservando original/calidad; no cambiar fotos ni comprimir el logo destructivamente. Solo convertir si la medicion lo justifica.
- **Verify:** pruebas de URL valida/invalida, width/calidad, query, transparencia, blob/local/fallback; desktop y mobile comprueban naturalWidth > 0 y ausencia de /_next/image para fotos Cloudinary compatibles. Comprobar previews de subida y carta/promos sin cambios de precios.
- **Comando previsto:** npm.cmd run test:e2e -- e2e/image-delivery.spec.ts (crear test antes de ejecutarlo).
- **Memoria:** rehacer baseline con build actualizado; mantener prueba de imagenes locales y agregar un escenario representativo de entrega CDN. No presentar como ahorro del cambio CDN una prueba que solo solicita imagenes locales. Comparar mismos assets, concurrencia y cache fria/caliente.

### T2: Liberar estado caducado del limitador

- **Hacer:** contrastar version instalada/lock 6.5.0 con codigo/documentacion oficial y correcciones compatibles disponibles. Si hay una correccion upstream adecuada, preferirla; de lo contrario usar el contrato de almacenamiento de Nest con expiracion comprobable y limpieza acotada.
- **Archivos:** apps/api/src/app.module.ts; apps/api/src/common/ (almacenamiento y specs si necesario); package.json/package-lock.json solo si se justifica actualizar; script de reproduccion adaptado a la solucion real.
- **Semantica:** conservar conteo, TTL, blockDuration, clave por ruta/identidad y respuestas 429/Retry-After. No sustituir ventana deslizante por fija sin detectar el cambio. No limpiar todos los timers de otras identidades al desbloquear una clave.
- **Verify:** Jest con reloj controlado: expiracion de hits, bloqueo mayor/menor al TTL, identidad activa protegida, claves independientes, varias configuraciones, concurrencia, cierre de timers y dos tandas de identidades nuevas. Tras expiracion completa no deben acumularse claves sin uso. Regresion de guards/login y health.
- **Comandos previstos:** npm.cmd run test -w @mordida/api -- --runInBand; node scripts/audit-rate-limit-memory.cjs (debe probar la solucion instalada, no dejarse apuntando solo al codigo anterior).
- **Aceptacion:** almacenamiento recupera su nivel base despues de caducidad; siguen bloqueandose solicitudes abusivas. No atribuir este ahorro a la memoria del servicio web.

### T3: Consultas periodicas sin acumulacion

- **Hacer:** aplicar sondeo secuencial con una ronda en vuelo por pantalla, AbortController al desmontar/cambiar filtros, timeout explicito y reintento acotado. Mantener cadencia operativa nominal de cocina 2 s, caja 8 s y seguimiento 10 s; bajo lentitud no acumular rondas.
- **Archivos:** apps/web/components/admin-kitchen-client.tsx, admin-orders-client.tsx, tracking-client.tsx; helper pequeno compartido en lib/ o hooks si evita duplicacion; api.ts solo para propagacion de cancelacion compatible; e2e/polling-resilience.spec.ts (nuevo).
- **Ajustes:** separar configuracion editable de la actualizacion de pedidos para no pisar formularios. Conservar actualizacion de estado de servicio, aplicar ajustes tras guardar y no dejar indefinidamente configuracion operativa obsoleta entre dispositivos.
- **Sesiones:** cancelar una pantalla no debe cancelar el refresh compartido de otras peticiones. No reintentar automaticamente escrituras de pedidos/cobros. No confundir timeout con cierre de sesion.
- **Seguimiento:** detener sondeo terminal solo tras revisar estados y eventos que deben seguir siendo visibles; no saltar la confirmacion de pago/analitica.
- **Verify:** Playwright simula API mas lenta que intervalo, error 500, desconexion y recuperacion, 401/refresh, cambio de filtros, navegacion repetida y pedido nuevo. Maximo una ronda en curso; cero rondas nuevas tras desmontar; respuesta antigua descartada; alarma disponible; caja sigue refrescando; seguimiento conserva datos y precio.
- **Comando previsto:** npm.cmd run test:e2e -- e2e/polling-resilience.spec.ts (crear test antes de ejecutarlo).

## Done (validacion final)

- [ ] T1 verificado en escritorio/movil con imagenes reales publicas y fixtures controlados.
- [ ] T2 probado con reloj y seguridad/concurrencia; retencion corregida.
- [ ] T3 probado con lentitud, navegacion, renovacion y recuperacion; pedidos/alertas siguen actualizandose.
- [ ] npm.cmd run lint.
- [ ] npm.cmd run test -w @mordida/api -- --runInBand.
- [ ] npm.cmd run build -w @mordida/web.
- [ ] npm.cmd run prisma:generate -w @mordida/api y npm.cmd run build -w @mordida/api cuando corresponda al entorno local.
- [ ] E2E dirigidos y regresiones relacionadas pasan; registrar claramente uso de mocks.
- [ ] Mediciones repetidas con build de produccion, escenarios equivalentes y periodos de reposo; JSON/capturas conservados.
- [ ] git diff --check y revision de archivos modificados; dejar fuera artefactos anteriores.
- [ ] Informe antes/despues por servicio, con limites de validacion Windows/BD/Render y pasos de rollback.
- [ ] Parar servidores auxiliares de pruebas; no dejar procesos duplicados.
- [ ] Presentar resultado local al usuario. No declarar resuelto el OOM de produccion hasta medir alli despues del despliegue autorizado.

Preparacion realizada: estado Git revisado, baseline documentado, herramientas de pruebas existentes identificadas. No se ejecutaron nuevamente tests/build en esta fase documental ni se implementaron correcciones.
