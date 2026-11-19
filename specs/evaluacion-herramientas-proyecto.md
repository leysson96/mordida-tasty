# Evaluacion de herramientas del proyecto

Actualizacion documental: 2026-11-19 10:03:19 +01:00 (Europe/Madrid).
Se conserva la pausa de T11-T14; proxima tarea activa CRM T7 tras cierre npm.
No se repiten los experimentos de esta hoja en esta actualizacion.

Fecha: 2026-11-05. Base funcional publicada: 267fa01. Los experimentos locales de S1 siguen sin publicar.

## Objetivo y autorizacion

PRIORIDAD VIGENTE 2026-11-18: el usuario ordena primero Seguridad-S5 picomatch,
despues Estabilidad-T7 CRM y Estabilidad-T9 audio. T11-T14 de esta hoja quedan
pausadas; las notas siguientes conservan el estado anterior, no ordenan retomarlas.
Referencia prevalente: [indice activo](../docs/ESTADO_TRABAJO.md).

Estado 2026-11-17: T10 ya publicada en e4a6a10. T12 conserva Nest/ESLint/Jest
por falta de evidencia para una sustitucion segura; no implica completar T11,
T13 ni T14. Antes de proseguir migraciones, atender S4 Next y documentar S5
picomatch. Ver [estado consolidado](../docs/SEGURIDAD_HERRAMIENTAS_2026-11-17.md).

Prioridad de seguridad actualizada: glob se gestiona explicitamente como S3 en specs/seguridad-herramientas-desarrollo.md. Intentar parche compatible antes de convertirlo en una migracion T11; no mezclar T11 incompleta con el commit de seguridad.

Elegir cambios de herramientas por compatibilidad y beneficio medible, no por ser mas nuevos ni por ocultar alertas. El usuario autoriza documentar y comenzar inventario/comparacion; NO autoriza aun sustituir Nest CLI, ESLint o Jest hasta demostrar la mejor opcion para el proyecto.

No modificar ni revertir silenciosamente los experimentos existentes. Los informes deben indicar si usan el entorno local de S1 o un checkout publicado. Sin commit/push ni gestion de Render en esta evaluacion.

## T10: Inventario y dependencias potencialmente innecesarias

- Revisar scripts, configuraciones, imports y consumidores transitivos con git grep/rg, npm ls y package-lock.json.
- Registrar uso explicito, uso indirecto y ausencia de referencias; ausencia de imports por si sola no demuestra que sea seguro borrar un paquete.
- Candidato inicial: eslint-config-next. La configuracion root importa @next/eslint-plugin-next directamente y activa recommended/core-web-vitals. Comparar configuracion efectiva de ESLint con --print-config para archivos representativos web/API antes y despues de una eliminacion simulada en entorno aislado.
- @nestjs/schematics esta referenciado por nest-cli.json: no clasificarlo como inutil solo porque no aparezca en codigo de negocio.
- Herramientas: Node/npm existentes y parser JSON estandar; sin librerias de analisis nuevas.
- Aceptacion: inventario con candidatos y evidencia; ninguna perdida de reglas, resolucion de plugins o scripts para considerar una retirada.

## T11: Comparar Nest CLI con TypeScript directo

- Conservar Nest como framework, los mismos fuentes, version TypeScript, CommonJS, emitDecoratorMetadata, experimentalDecorators y configuracion de rutas.
- Compilar a dos carpetas nuevas, sin sobrescribir apps/api/dist ni modificar build/start/dev actuales.
- Usar scripts/compare-api-compilers.mjs: invoca los CLI realmente instalados, guarda stdout/stderr y tiempos, compara inventario y hash de .js/.d.ts. Los source maps se registran aparte: sus rutas pueden depender de outDir.
- Verificar src/main.js, prisma/seed.js, metadatos de decoradores y diferencias de archivos. No excluir tests de una salida y mantenerlos en otra para aparentar equivalencia.
- Herramientas: TypeScript Compiler CLI, Nest CLI instalado, node:child_process y node:crypto; no bundler ni SWC/tsx adicional.
- Aceptacion inicial: salida funcional identica o diferencias explicadas. Esto NO certifica por si solo arranque con BD, inyeccion en ejecucion o recarga del servidor.
- Verificacion posterior: arranque de API con configuracion y PostgreSQL exclusivamente de prueba, health, inyeccion, imports y recarga tras cambio/eliminacion de archivo; respetar que el usuario no desea WSL/Docker. Si no hay BD aislada disponible, dejar prueba pendiente y no retirar el CLI.
- Registrar memoria/tiempos como metricas de compilacion local, no como ahorro de RAM del servidor de ventas.

## T12: Propuesta revisable de simplificacion

- Con resultados de T10/T11, proponer retiro solo de dependencias demostradas innecesarias y/o uso de tsc en build.
- Diseñar por separado el modo desarrollo: compilacion inicial, watch, reinicio solo tras compilacion valida, cierre de procesos y comportamiento ante errores. No sustituir nest start --watch por un comando que ejecute antes de compilar.
- Revisar copia de assets, plugins, sourcemaps, limpieza de artefactos obsoletos y entrada dist/src/main.js; no cambiar comandos Render existentes si no hace falta.
- Comparar el arbol transitivo resultante en instalacion limpia: paquetes/alertas eliminados y restantes. No prometer que eliminar el CLI elimina deepmerge/minimatch de Jest o ESLint.
- Aceptacion: propuesta concreta con diffs, riesgo, rollback y resultados. Adopcion permanente solo despues de revisar evidencia con el usuario.

## T13: Evaluacion de lint (no migracion aprobada)

- Comparar ESLint actual frente a Oxlint u otra alternativa mantenida solo si T10 no basta.
- Revisar documentacion/version estable al ejecutar, Node requerido, compatibilidad Windows/Linux, instalacion y todas las reglas efectivas TypeScript/Next.
- Ejecutar ambos sobre fixtures que deben producir errores y sobre codigo real; contabilizar reglas perdidas/nuevas y falsos positivos, no solo tiempo de ejecucion.
- Mantener ESLint si no hay equivalencia suficiente. No desactivar controles ni cambiar reglas de negocio por adaptar el linter.
- Herramientas candidatas: Oxlint; version por decidir tras prueba, sin instalarlo ahora.

## T14: Evaluacion de tests (ultimo paso, no migracion aprobada)

- Comparar Jest/ts-jest actual con Vitest, verificando decoradores/metadata, CommonJS/ESM, mocks/hoisting, fake timers, Nest TestingModule y discovery.
- Usar primero muestras representativas de auth, pagos, concurrencia, expiracion y HTTP. No sustituir jest por vi mediante reemplazo ciego.
- Si se propone migracion, conservar todas las aserciones/suites y equivalencia de resultados; incluir una prueba que falla deliberadamente para comprobar que el nuevo runner detecta fallos.
- No añadir un transformador que pierda emitDecoratorMetadata. Evaluar dependencias nuevas de Vitest/Vite en conjunto antes de atribuir ahorro.
- Aceptacion: equivalencia de las 302 pruebas existentes como referencia y de cualquier prueba legitima añadida; ninguna omitida para conseguir verde. Si el coste no compensa, conservar Jest documentando el riesgo residual.

## Restricciones comunes

- T1-T3 de imagenes/sondeo/memoria no se modifican; tampoco precios, pedidos, sesiones, datos de clientes o UI.
- Sin pruebas de carga, ventas, emails ni migraciones contra produccion.
- Ninguna alternativa garantiza ausencia futura de vulnerabilidades. Menor mantenimiento se demuestra con menos dependencias relevantes, buen soporte y compatibilidad, no solo con popularidad.
- Sin override global incompatible, aliases entre APIs distintas, audit fix --force, forks improvisados ni descarte de alertas para maquillar el resultado.
- Render exclusivamente a cargo del usuario. Commit/push solo con autorizacion posterior sobre cambios revisables.

## Verificacion antes de adoptar cambios

1. Instalacion limpia desde lock en entorno temporal.
2. Configuracion efectiva de lint equivalente; lint correcto.
3. Pruebas API con discovery completo y builds API/web.
4. E2E relacionados: registro, sesiones, promociones, carrito, checkout simulado, uploads y sondeo sin solapamiento.
5. Informe de diferencias, alertas que persisten, recursos medidos y limitaciones del entorno.
6. Revision final de archivos y rollback sin perder trabajo ajeno.

Estado 2026-11-06: T10 verificada y limpieza de eslint-config-next aplicada localmente como primer cambio de T12: 143 paquetes menos, mismas reglas, lint/builds y regresiones correctos. Sin commit/push. T11 conserva pruebas de compilacion/errores, pero arranque con BD y watch siguen pendientes; Nest CLI permanece. T13/T14 siguen como evaluaciones futuras. Ver docs/EVALUACION_HERRAMIENTAS_2026-11-05.md para resultados y correccion temporal del test de promociones.

Avance T11: watcher real y servidor HTTP de fixture probados (edicion, error, recuperacion, borrado y cierre con permisos). Quedan arranque real Nest/Prisma con PostgreSQL de prueba, limpieza de salidas y reinicio coordinado multifichero. No sustituir nest start --watch por el fixture.
