# Evaluacion inicial de herramientas

Fecha: 2026-11-05. Sin sustituciones, actualizaciones, commit/push ni operaciones Render en esta tarea.

## Alcance y baseline

Se usa el checkout local basado en 267fa01 con el experimento S1 (override selectivo de minimatch moderno) ya existente. No se presenta como un checkout limpio de produccion. No se han revertido ni adoptado esos cambios. No se modificaron package manifests, lockfile, scripts build/dev/start, configuracion ESLint, codigo de negocio o dist del API durante esta evaluacion.

Hoja de trabajo: specs/evaluacion-herramientas-proyecto.md, tareas T10-T14.

## T10: inventario iniciado y configuracion efectiva capturada

| Herramienta | Evidencia | Decision actual |
| --- | --- | --- |
| Nest CLI | apps/api/package.json usa nest build y nest start --watch | No retirar; tambien administra desarrollo |
| TypeScript | tsconfig API usa CommonJS, decoradores y metadata; compilador 5.9.3 instalado | Candidato para build directo, sin actualizar version |
| @nestjs/schematics | nest-cli.json lo referencia como collection | No tratarlo como paquete inutil |
| eslint-config-next | Declarado en web; no se encontro import activo en configuracion/scripts versionados | Candidato a eliminacion aislada, NO eliminado |
| @next/eslint-plugin-next | eslint.config.mjs lo importa y activa recommended/core-web-vitals | Necesario con configuracion actual |
| Jest/ts-jest | jest.config.js usa ts-jest y src/**/*.spec.ts; amplio uso de mocks/timers | Mantener; no hay migracion aprobada |

ESLint --print-config real:

- apps/web/app/page.tsx: 24 entradas de reglas (incluye no-explicit-any desactivada), plugins TypeScript y Next.
- apps/api/src/main.ts: 2 entradas de reglas, no-unused-vars como warning y no-explicit-any desactivada.
- Estas cifras son baseline, no un juicio de cobertura suficiente. No se activaron/desactivaron reglas en esta tarea.

Pendiente T10: simular retirar eslint-config-next en un entorno separado, instalar desde lock y comparar configuracion efectiva/resolucion de plugins antes/despues. Ausencia de imports por si sola no demuestra que no aporte dependencias por hoisting. No retirarlo hasta cerrar esa comprobacion.

## T11: primera comparacion de compilacion completada

Comando: node scripts/compare-api-compilers.mjs.

Salida generada en audit-artifacts/toolchain-comparison/1793904786207, con configuraciones, logs y comparison.json.

| Dato | Nest CLI | tsc |
| --- | --- | --- |
| Version | 11.0.24 | TypeScript 5.9.3 |
| Codigo de salida | 0 | 0 |
| JS y declaraciones generados | 240 | 240 |
| Tiempo observado | 11997 ms | 8063 ms |
| Diferencias de contenido .js/.d.ts | 0 | 0 |

- Node 22.19.0, Windows.
- Se hereda el mismo tsconfig; solo outDir y tsBuildInfoFile cambian para no tocar los artefactos normales.
- src/main.js presente; prisma/seed.js presente; design:paramtypes presente en AuthService compilado.
- Los archivos se comparan por nombre relativo y SHA-256 de su contenido completo.
- El primer intento de Nest con ruta absoluta de tsconfig fallo por resolucion del CLI en Windows. Se uso --path relativo al directorio API y se repitio correctamente. Esa primera ejecucion (1793904741732) no aporta resultados de equivalencia.

Los tiempos son una sola ejecucion secuencial; caches y orden pueden influir. No acreditan un porcentaje de mejora estable ni menor RAM de Render. No se midio memoria de compilacion en este script.

## Lo que aun NO esta demostrado

- Arranque real de ambas salidas con PostgreSQL aislado y configuracion equivalente.
- Recarga en desarrollo, errores de compilacion, eliminacion de fuentes y limpieza de archivos obsoletos.
- Equivalencia de source maps (no incluidos en comparacion por hash) y diagnosticos de depuracion.
- Eliminacion efectiva de dependencias/alertas en una instalacion candidata sin Nest CLI.
- Paridad de reglas de Oxlint o de mocks/decoradores con Vitest: no se instalaron ni probaron.

Por tanto, no se cambia todavia build a tsc ni se elimina Nest CLI. La comparacion justifica continuar la evaluacion, no desplegar una migracion.

## Siguiente trabajo concreto

1. Cerrar T10 con eliminacion simulada de eslint-config-next y comparacion de reglas.
2. Completar T11 con prueba de arranque aislado y diseno/verificacion de watch.
3. T12 presenta un diff adoptable solo con esas evidencias y listado de alertas restantes.
4. T13 y T14 se evaluan despues; no son migraciones decididas.

Reportes/CRM siguen pausados. No se ejecutaron pagos, emails, migraciones ni escrituras de datos de clientes. Los dos procesos de compilacion terminaron; no queda un servidor nuevo en ejecucion.

## Avance posterior: T10 probado en instalacion aislada

Ejecutado scripts/evaluate-eslint-cleanup.mjs. Copia temporal nueva sin .env, uploads, node_modules o builds previos del proyecto; npm ci --ignore-scripts para baseline, retirada de eslint-config-next SOLO del manifest temporal, instalacion candidata y segundo npm ci limpio.

Evidencia: audit-artifacts/eslint-cleanup/1793911897037/comparison.json y logs de cada paso.

- Configuracion efectiva completa de ESLint identica antes/despues para app/page.tsx, admin-orders-client.tsx y API main.ts.
- Reglas: 24, 24 y 2 entradas respectivamente, incluyendo las reglas desactivadas; no se perdieron controles que estuvieran activos.
- Entradas del mapa packages del lock: 1051 -> 908 (143 menos). Son entradas del lock, no una medicion de RAM ni un numero de vulnerabilidades cerradas.
- Lint completo API/web en la copia candidata: pasa.
- Build web en esa misma copia candidata, sin variables de produccion: pasa.
- No se retiraron @next/eslint-plugin-next ni los plugins TypeScript usados por la configuracion.
- No se modificaron manifest, lock ni instalaciones del proyecto principal durante T10; siguen los cambios de S1 previos. No se adoptaron Oxlint/Vitest.

Conclusion T10: eslint-config-next es un candidato demostrado a retirada para la configuracion actual. Esto elimina ramas redundantes de plugins no activos, pero no todas las copias minimatch/deepmerge de otras herramientas. No implica que la configuracion actual de lint cubra todas las reglas posibles de React; conserva exactamente lo que estaba activado.

La instalacion se hizo con ignore-scripts para no ejecutar hooks en el experimento. El build posterior comprueba la compilacion web con los binarios disponibles; no certifica todos los postinstall en Linux ni un despliegue Render. La copia temporal se conserva para siguientes pruebas.

## Avance T11: comportamiento ante cambios y archivos eliminados

Ejecutado scripts/evaluate-tsc-lifecycle.mjs. Evidencia: audit-artifacts/tsc-lifecycle/1793912004376/comparison.json.

- Fixture TypeScript compila correctamente.
- Modificar un valor genera salida nueva.
- Con noEmitOnError=true, un error de tipo 2322 impide emitir y conserva la ultima salida valida.
- Eliminar el fuente NO borra su JavaScript previo. Confirmado staleOutputRemains=true.

Es una prueba de la API del compilador sobre fixtures, no de un servidor en modo watch. La politica noEmitOnError se probo solo en el fixture, no se modifico tsconfig del API. Una migracion permanente necesita limpieza segura de salida y control de reinicios tras compilaciones validas.

No se localizaron psql/postgres/pg_isready en PATH ni servicios PostgreSQL registrados mediante la consulta local. Esto no prueba que no exista otra BD disponible; solo que no hay instancia de pruebas identificada. Arranque completo con BD y watch del servidor siguen pendientes, sin usar produccion ni instalar WSL/Docker.

## Decision propuesta T12

Primera simplificacion propuesta: retirar unicamente eslint-config-next, conservando ESLint y @next/eslint-plugin-next. Hay evidencia concreta de menos dependencias, mismas reglas y build correcto. Todavia NO aplicada al proyecto principal.

Nest CLI se mantiene hasta cerrar las pruebas de arranque/watch/limpieza. Oxlint y Vitest siguen como evaluaciones futuras, no decisiones de migracion. No se crean commits ni se sube nada con esta propuesta.

## Aplicacion local de la limpieza: 2026-11-06

Tras la continuacion del usuario se retira eslint-config-next del manifest web principal y se actualiza el lockfile. Se conserva ESLint, los plugins realmente usados y los comandos build/dev/start; no se migra ninguna herramienta.

- npm elimina 143 paquetes; se mantienen los metadatos glibc de Sharp para Linux.
- Comparacion de --print-config contra el baseline aislado: identica para los tres archivos representativos (24/24/2 entradas de reglas).
- Lint API/web: pasa.
- Suite API: 32 suites, 302 tests pasan.
- Build API y web: pasan.
- E2E: primera pasada 38/40. Los dos fallos eran el test de promocion activa cuya fixture terminaba el 2026-11-05. Se fija solo el reloj del navegador de ese test a 2026-10-30; reejecucion desktop/mobile 2/2 pasa. No se modificaron fechas/reglas comerciales de produccion ni se ocultaron aserciones. Los otros 38 casos no se repitieron al no cambiar codigo funcional.
- npm audit --omit=dev: cero vulnerabilidades en la consulta de esta tarea. No se afirma cierre de las alertas restantes de desarrollo.
- No hay nuevas variables, migraciones, pagos ni correos reales. E2E usa fixtures y conserva las limitaciones documentadas del favicon/URLs ficticias.

Estado actual: limpieza local aplicada y probada, sin commit/push. Los cambios S1 previos siguen separados conceptualmente en el mismo worktree. T11 mantiene pendientes la recarga completa del servidor y el arranque con PostgreSQL de prueba; el CLI de Nest no se elimina. Oxlint/Vitest no se instalan.

## T11: prueba real de watch sobre servidor aislado, 2026-11-06

scripts/evaluate-watch-lifecycle.mjs genera un servidor HTTP de prueba y ejecuta TypeScript --watch con noEmitOnError y Node --watch. No cambia comandos del restaurante. Evidencia: audit-artifacts/watch-lifecycle/1793956765684/result.json.

- Compilacion inicial -> HTTP responde version 1.
- Edicion correcta -> nuevo proceso HTTP responde version 2.
- Error TS2322 -> se conserva el JS previo y el mismo proceso sigue respondiendo version 2.
- Correccion del error -> nuevo proceso responde version 3.
- Eliminacion de fuente -> TypeScript recompila pero mantiene el JS eliminado (riesgo pendiente confirmado).
- Cierre -> el servidor ya no responde. En Windows el sandbox denego taskkill automatico: se identificaron los PID exclusivos del ensayo y se cerraron con permiso elevado. No se cerraron servicios ajenos; no se presenta como prueba de cierre automatico sin permisos.

La prueba valida watcher/HTTP en un fixture, NO arranque de la API del restaurante con Nest/Prisma, ni atomicidad de una emision de muchos archivos. Node --watch puede reaccionar mientras TypeScript sigue escribiendo varios archivos; una sustitucion profesional debe coordinar el reinicio al terminar una compilacion correcta, no adoptar a ciegas este fixture como comando dev.

Decision: mantener Nest CLI. Antes de retirarlo faltan PostgreSQL aislado para arranque/health de ambas salidas, limpieza de artefactos obsoletos y reinicio coordinado de una compilacion multifichero. Se puede publicar la limpieza de eslint-config-next por separado cuando el usuario lo autorice; no depende de migrar el compilador.
