# Actualizacion de dependencias vulnerables

Fecha: 2026-10-31. Cambios locales acumulados con T4; sin commit/push ni acciones en Render.

## Versiones aplicadas

| Paquete | Anterior | Verificada |
| --- | --- | --- |
| multer | 2.4.0 | 2.5.0 |
| body-parser | 2.3.0 | 2.4.0 |
| zod | 4.6.5 | 4.6.7 |
| nodemailer | 10.0.13 | 10.3.1 |
| qs | 6.16.0 | 6.17.1 |
| fast-uri | 3.1.8 | 3.1.9 |

Versiones consultadas en npm al trabajar. Se eligio fast-uri 3.1.9, parche compatible dentro de 3.x, en lugar de imponer 4.2.3 a consumidores de 3.x. Las otras versiones son las ultimas publicadas consultadas en sus paquetes. body-parser se actualizo transitivamente sin agregar una dependencia directa innecesaria. No se uso audit fix --force.

Manifest y lock revisados: sin actualizacion de Nest/React/Next/Prisma/Stripe ni del limitador corregido en T2. Metadatos libc de Sharp Linux preservados. Sin variables nuevas ni migraciones.

## Auditoria actual

- npm audit --omit=dev --json: cero vulnerabilidades, exit 0.
- npm audit completo: cero criticas, altas y moderadas; nueve nodos con severidad baja procedentes del mismo aviso de deepmerge.
- Estos resultados corresponden al arbol local/lockfile propuesto. No prueban cierre de Dependabot remoto mientras no se haga push y GitHub reevalua main.

## Pendiente sin parche compatible publicado

deepmerge 4.3.1: GHSA-gcqx-w48m-w2h4. El registro y el aviso oficial consultados no ofrecen una version corregida. Se comprobaron tambien jest-config 30.5.2 y fork-ts-checker-webpack-plugin 9.1.0: ambos conservan deepmerge. Actualizar Jest de version mayor no elimina el aviso.

No se sustituyo deepmerge por deepmerge-ts o @fastify/deepmerge mediante un alias: sus contratos no son equivalentes. No se rebajo a una version antigua, no se elimino la alerta y no se creo un fork para aparentar un audit limpio.

Exposicion identificada: configuracion de build/test mediante Jest y fork-ts-checker-webpack-plugin/Nest CLI. No esta en el arbol de runtime segun npm audit --omit=dev; las instalaciones de build siguen incluyendolo. Solo ejecutar build/tests con codigo y configuracion de confianza. Pendiente de parche oficial o sustitucion compatible de los consumidores; esto no significa que el aviso este resuelto.

## Verificaciones realizadas

- Suite API: 31 suites, 300 tests pasan despues de las actualizaciones.
- Dos tests adicionales de compressed-body.spec.ts: pasan. HTTP local real con gzip valido, bytes raw preservados y gzip con basura final rechazado con 400; una peticion posterior sigue respondiendo. El log de BadRequest durante el caso negativo es esperado, no un crash.
- scripts/verify-multer-security.cjs ya verifico la correccion de callback tardio en T4; multer permanece en 2.5.0.
- Lint API/web: pasa; se repitio lint API tras agregar la prueba adicional.
- Builds API y web: pasan.
- E2E: 40 pruebas pasan en desktop/mobile (imagenes, promociones, carrito, registro/login, checkout simulado, 2FA, uploads y resiliencia de sondeo).
- git diff --check: sin errores. next-env.d.ts vuelve al estado original tras build.

No hubo pagos, emails o escrituras a BD de produccion. E2E usa API/Stripe simuladas y contiene los 404 de fixtures ficticios descritos en informes anteriores; las pruebas HTTP nuevas usan servidor local real. No se afirma ausencia universal de fallos o validacion de sesiones de varias horas.

## Publicacion pendiente

Sin commit ni push en esta tarea. Con autorizacion, subir los cambios de seguridad juntos, excluyendo artefactos y documentos ajenos. El usuario despliega ambos servicios en Render, ya que Zod afecta web y los parsers/correo afectan API. Despues comprobar alertas de GitHub, login, subida de logo/producto, checkout y correo de prueba controlado. No cerrar manualmente alertas aun no reevaluadas.

Referencias oficiales:

- https://github.com/advisories/GHSA-27r3-jxmh-p828
- https://github.com/advisories/GHSA-mrhx-c7xc-m3w5
- https://github.com/advisories/GHSA-q7qp-rjg7-q26m
- https://github.com/advisories/GHSA-8c8m-p3m8-cjg8
- https://github.com/advisories/GHSA-6pq8-jhm2-2vcw
- https://github.com/advisories/GHSA-gcqx-w48m-w2h4
