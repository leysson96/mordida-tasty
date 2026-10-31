# T4: correccion de Dependabot #26

Fecha: 2026-10-30. Base: db21b48. Cambios locales; sin commit, push o despliegue.

Actualizacion 2026-10-31: los avisos adicionales con parche compatible se han corregido localmente. Produccion: cero avisos en npm audit --omit=dev; solo deepmerge permanece en herramientas de desarrollo. Ver SEGURIDAD_DEPENDENCIAS_2026-10-31.md. Los recuentos de las secciones siguientes son el registro historico de T4 antes de esa ampliacion.

## Identificacion confirmada

Se consulto la API autenticada de GitHub para la alerta concreta, reutilizando el gestor de credenciales existente sin imprimir ni guardar secretos. La pagina sin autenticar devuelve 404, pero la API autorizada confirmo:

- Repositorio: leysson96/mordida-tasty; alerta 26; estado open al consultar.
- Paquete: multer, version 2.4.0, dependencia transitiva de runtime de @nestjs/platform-express.
- GHSA-q7qp-rjg7-q26m / CVE-2026-113872, severidad alta.
- Vulnerables: >=2.0.0 y <2.5.0. Primera version corregida: 2.5.0.
- Condicion: callback de fileFilter asincrono pendiente tras desmontar el parser multipart puede provocar un error no manejado y finalizar Node.
- En las dos rutas de subida actuales se usa FileInterceptor con limite de bytes, sin fileFilter asincrono configurado. No se demostro explotacion de esas rutas ni relacion causal con el OOM anterior del servicio web.

Fuente: https://github.com/expressjs/multer/security/advisories/GHSA-q7qp-rjg7-q26m
Parche oficial: https://github.com/expressjs/multer/commit/80a2d9df1dfd63b5fab631b8b9966164ed647adf

## Cambios

1. Override existente en package.json: multer 2.4.0 -> 2.5.0.
2. Lockfile actualizado solamente para Multer, con tarball e integridad. npm install no sustituyo inicialmente la resolucion; npm update multer hizo efectiva la actualizacion. Metadatos libc/glibc de Sharp se conservaron.
3. UploadErrorInterceptor limitado a las dos rutas de subida: convierte LIMIT_UNEXPECTED_FILE a BadRequestException. Nest 11.2.3 compara textos y esperaba "Unexpected field"; Multer 2.5 devuelve "Unexpected file field". La prueba detecto un 500, corregido a 400 por codigo estable. No se transforman otros errores ni se debilitan guards/limites.
4. Prueba HTTP multipart local con Nest: bytes y metadata intactos, limite de tamano devuelve 413 y campo inesperado devuelve 400.
5. scripts/verify-multer-security.cjs reproduce el callback tardio y multipart truncado en proceso aislado, basado en el escenario del parche oficial. No hace peticiones a produccion. El proceso sobrevive, el middleware completa una vez y libera archivos.

Sin cambios en BD, configuracion de Render, credenciales, precios, promociones, calculo de pedidos ni frontend. El script temporal utilizado para leer la alerta se elimino despues de la consulta.

## Resultado real

```text
npm ls multer --all: multer@2.5.0, sin copias 2.4.0
node scripts/verify-multer-security.cjs: PASS
npm run test -w @mordida/api -- --runInBand: 31 suites / 300 tests pasan
npm run lint -w @mordida/api: pasa
npm run build -w @mordida/api: pasa
git diff --check: pasa
```

No se ejecuto un pago real ni una subida al Cloudinary de produccion. Los tests de servicios/auth existentes usan sus fixtures y mocks; la prueba nueva del parser usa HTTP real local. No hubo cambios web que justificaran repetir toda la suite de navegador.

## Auditoria adicional: NO todo esta limpio

npm audit antes: 37 nodos afectados (12 high, 18 moderate, 7 low). Despues del arreglo de Multer: 36 (11 high, 18 moderate, 7 low). Los padres heredan avisos: estos totales NO representan 36 fallos independientes.

Paquetes raiz pendientes detectados, sin cambiar en este arreglo acotado:

| Paquete instalado | Severidad del aviso | Referencia / estado |
| --- | --- | --- |
| body-parser 2.3.0 | Alta | GHSA-27r3-jxmh-p828; parche 2.4.0, via express/Nest |
| zod 4.6.5 | Alta | GHSA-mrhx-c7xc-m3w5; parche desde 4.6.6; 4.6.7 publicado al consultar |
| fast-uri 3.1.8 | Moderada/baja | GHSA-w74x-v6f9-j3xg, GHSA-xhq7-xmqj-769h, GHSA-wjr9-j795-jxcr, GHSA-333x-w4r6-6crp; comprobar parche compatible 3.x, no saltar a 4.x automaticamente |
| nodemailer 10.0.13 | Moderada | GHSA-8c8m-p3m8-cjg8, GHSA-m943-m63m-w62w, GHSA-85x2-q946-cp5h; parche desde 10.1.4 |
| qs 6.16.0 | Moderada | GHSA-6pq8-jhm2-2vcw; 6.17.1 publicado al consultar |
| deepmerge 4.3.1 | Baja | GHSA-gcqx-w48m-w2h4; sin version corregida publicada segun aviso consultado; aparece en herramientas de build/test |

Estos avisos se confirmaron mediante npm audit y referencias oficiales, pero no se identificaron como la alerta #26 ni se supuso que todos sean explotables en la aplicacion. Antes de avanzar a optimizaciones no urgentes, atender body-parser y zod y evaluar los demas con cambios separados y pruebas de compatibilidad. No usar npm audit fix --force ni suprimir alertas para aparentar auditoria limpia.

## Publicacion y cierre

El parche de #26 esta listo localmente. La alerta GitHub permanece abierta hasta subir el commit autorizado y confirmar que Dependabot reevalua main. No se marca como cerrada ni se afirma que GitHub esta sin vulnerabilidades.

El usuario gestiona Render. Tras push autorizado, desplegar API desde el SHA correcto y comprobar subida de producto/logo. No hay nuevas variables ni migraciones.

Rollback: restaurar manifest/lock y adaptacion de uploads, reinstalar y reconstruir. Volver a 2.4.0 reintroduce el aviso; solo considerar con una regresion real y alternativa evaluada.
