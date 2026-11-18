# Seguridad de herramientas: minimatch, deepmerge y glob

## Contexto

- Actualizacion 2026-11-17: S1-S3 pasan localmente, pero una auditoria nueva
  detecta Next (S4) y picomatch (S5). No reutilizar el cero de avisos del dia 12
  como resultado vigente. Ver [seguimiento actual](../docs/SEGURIDAD_HERRAMIENTAS_2026-11-17.md).

- Estado actualizado 2026-11-11: limpieza publicada en e4a6a10; S2 deepmerge corregida y probada localmente, pendiente de publicacion autorizada. Glob se formaliza como S3 en esta hoja. Las entradas anteriores son contexto historico, no una consulta actual de alertas.

- Preparado el 2026-11-04. Base local: 267fa01, commit de seguridad ya subido a main.
- Reportes/CRM quedan pausados por instruccion del usuario mientras se atienden estas alertas.
- Ultima consulta autenticada de GitHub, 2026-11-02: abiertas #42 minimatch (moderada, desarrollo, transitiva) y #40 deepmerge (baja, desarrollo, transitiva). Refrescar el estado al comenzar; no presentar ese resultado como una consulta del dia 4.
- #42: GHSA-g3hv-75wg-m249. Aviso declara versiones <11.0.1; la descripcion tecnica menciona firstPhasePreProcess y optimizationLevel >=2 en 10.2.6. La alerta tambien marca 3.1.5: revisar cada rama y no descartar automaticamente las antiguas por esa diferencia.
- #40: GHSA-gcqx-w48m-w2h4, deepmerge >=4.2.0 <=4.3.1; sin parche publicado en la ultima consulta. Comprobar de nuevo antes de decidir.
- Arbol observado: minimatch 3.1.5 mediante ESLint, Jest/glob 7 y fork-ts-checker-webpack-plugin; 10.2.6 mediante glob 13/Nest CLI y typescript-estree. deepmerge 4.3.1 mediante Jest y fork-ts-checker-webpack-plugin.
- Diferencia verificada: consumidor ESLint recibe minimatch 3 como funcion; consumidor glob moderno recibe exportaciones como objeto. Un override global a 11 no garantiza compatibilidad.
- Node configurado: 22.19.0. Conservar los parches de runtime del commit 267fa01, la integracion Multer/Nest y los metadatos de Sharp Linux.
- Artefactos ajenos y documentos pendientes ya existen en el worktree: no borrarlos, incluirlos o revertirlos al trabajar.

## Objetivo

Eliminar las versiones vulnerables cuando exista una ruta compatible, o documentar una mitigacion verificable cuando no exista, sin romper build/tests ni cambiar la aplicacion del restaurante.

## Flujo

```text
1. Consultar alertas + registro npm + avisos oficiales.
2. Mapear todas las copias y sus consumidores en el lockfile.
3. Evaluar actualizacion del consumidor y contrato de la dependencia.
4. Aplicar una solucion aislada por alerta y reconstruir instalacion de prueba.
5. Ejecutar regresion de seguridad + lint + tests + builds.
6. Revisar diff y resultados -> presentar al usuario.
7. Solo con autorizacion: commit/push; usuario gestiona Render.

Parche compatible disponible?
  si -> actualizar consumidor/parche -> verificar todas las rutas transitivas
  no -> alternativa mantenida compatible disponible?
          si -> probar contrato antes de sustituir
          no -> documentar exposicion/mitigacion y trabajo pendiente

Verificacion falla? -> corregir o retirar solo el experimento propio
Verificacion pasa? -> informar resultado local; no afirmar cierre remoto sin verificar GitHub
```

## Restricciones

- Solo preparacion documental en este paso. Sin cambios de dependencias, commit, push o Render.
- Durante implementacion: sin npm audit fix --force, downgrade para escapar del rango del aviso ni aliases entre librerias con contratos diferentes.
- No desactivar ni descartar alertas automaticamente. Una mitigacion no equivale a un parche ni a cero vulnerabilidades.
- No modificar pedidos, precios, sesiones, datos de clientes, promociones, impresion o UI.
- No editar node_modules manualmente como solucion permanente.
- No instalar WSL/Docker. Instalacion limpia y pruebas pueden hacerse en directorio temporal local aislado; no ejecutar npm ci destructivo sobre el entorno compartido por defecto.
- No cargar produccion, probar patrones maliciosos en Render ni enviar configuraciones externas a herramientas con secretos de produccion.
- Priorizar actualizaciones oficiales compatibles. Version exacta/correccion y requisitos Node/peers se comprueban al ejecutar, no se dan por validos por ser "latest".

## Fuera de alcance

- T6-T9 (reportes, CRM, favicon y audio), cambios de planes o alojamiento.
- Migracion completa de Jest, ESLint o Nest solo para reducir el numero de alertas sin eliminar el paquete vulnerable.
- Publicar un fork o introducir una implementacion propia grande sin demostrar necesidad y equivalencia.

## Tareas

### S1: Minimatch #42

- **Hacer:** refrescar GitHub #42, npm audit y npm ls minimatch --all. Consultar versiones y dependencias de consumidores directos y transitivos. Registrar la cadena exacta de cada copia.
- **Eleccion:** preferir versiones de los consumidores que admitan una rama corregida. Evaluar backports oficiales si existen. Un override selectivo solo es aceptable si la API usada y las pruebas de ese consumidor son compatibles; no imponer 11 a paquetes que invocan directamente la exportacion de 3.
- **Si faltan rutas compatibles:** corregir las compatibles y dejar constancia de las restantes; no declarar cerrado el aviso ni reducir su severidad por decision propia. Una adaptacion mantenida requiere demostrar equivalencia antes de seleccionarla.
- **Herramientas:** npm view/ls/audit, GitHub API en lectura, fuentes oficiales del mantenedor, Node para repro aislado y scripts existentes de lint/build/test.
- **Archivos previstos:** manifest del consumidor afectado y package-lock.json; scripts/verify-minimatch-security.cjs y pruebas de compatibilidad si son necesarios; docs/VERIFICACION_S1_MINIMATCH.md.
- **Verify seguridad:** ejecutar patron de regresion acotado en proceso hijo con timeout y limite de memoria; no usar una entrada que bloquee el equipo. Comparar comportamiento vulnerable/corregido cuando sea factible, registrar tiempo y terminacion. No interpretar un timeout del harness como arreglo.
- **Verify compatibilidad:** import/require y forma de exportacion, globstar, negacion, dotfiles, braces, rutas Windows/POSIX, patrones reales de descubrimiento de tests y lint. No confundir cero tests descubiertos con exito.
- **Verify integral:** npm.cmd run lint; npm.cmd run test -w @mordida/api -- --runInBand; builds API/web; E2E relacionados si cambian herramientas compartidas del frontend. Comparar suites descubiertas con baseline (300 tests y dos adicionales en la ultima verificacion, no imponer un total si hubo cambios legitimos).
- **Cierre:** instalar desde lock en entorno limpio aislado, sin suprimir dependencias; confirmar que todas las copias afectadas se sustituyeron o documentar explicitamente las pendientes.

### S2: Deepmerge #40

- **Hacer:** refrescar aviso/registro; revisar consumidores reales (Jest y fork-ts-checker-webpack-plugin) y entradas que reciben. La ultima version de Jest consultada tambien dependia de deepmerge; no actualizarla asumiendo que lo elimina.
- **Eleccion:** parche oficial compatible o version del consumidor que elimine/sustituya realmente la dependencia. Si no existe, evaluar alternativa mantenida con el mismo contrato. No alias a deepmerge-ts/@fastify/deepmerge: no son sustitutos directos.
- **Mitigacion cuando no haya parche:** build/tests solo con configuraciones confiables; no ejecutar codigo/configuracion de PR no confiable con secretos; revisar workflows actuales antes de proponer cambios. Mantener dependencias dev fuera del runtime y comprobar el arbol efectivo. No afirmar que esta medida elimina el riesgo de build.
- **Herramientas:** npm/GitHub, inspeccion de consumidores, Node/Jest para prototipos y casos de mezcla, pipelines actuales.
- **Archivos previstos:** package manifests/lock si existe solucion compatible; prueba de regresion y docs/VERIFICACION_S2_DEEPMERGE.md. Workflows solo si la inspeccion demuestra una exposicion concreta.
- **Verify:** arrays, objetos anidados, customMerge/arrayMerge/isMergeableObject usados por consumidores, simbolos y claves especiales (__proto__, constructor, prototype). Comprobar que ni Object.prototype ni el prototipo del resultado reciben propiedades controladas por la entrada. Preservar resultados legitimos y configuraciones de Jest/webpack.
- **Cierre:** pruebas y builds correctos; documentar si es correccion completa o mitigacion con alerta abierta. Sin parche compatible, no inventar una version ni marcar como resuelto.

### S3: Glob / GHSA-3g3m-2fjr-6pw4

- **Estado 2026-11-12:** implementada y verificada localmente con glob 14.0.5 exclusivo de la cadena del CLI. Instalacion limpia, cancelacion, assets, watcher, lint, 303 tests API, builds y 40 E2E aprobados; audit completo/runtime sin avisos locales. Ver [informe S3](../docs/VERIFICACION_S3_GLOB.md), incluidos limites y fallo preexistente de carpetas literales en Windows. Sin commit/push; no afirmar cierre remoto. Alcance de herramientas, no migracion T11. Numero de alerta GitHub no confirmado.
- **Hallazgo local confirmado:** @nestjs/cli 11.0.24 fija glob 13.0.6. Su lib/compiler/assets-manager.js usa glob.sync para seleccionar/copiar assets y preparar su observacion. Las copias glob 7.2.3 de Jest son otra rama y no deben forzarse a 14 para este aviso.
- **Aviso observado:** cancelacion AbortSignal que puede permitir continuar recorriendo el sistema de archivos despues del timeout; rango >=9 <=14.0.1 en la consulta previa. Glob 14.0.3 fue el candidato corregido identificado. Actualizar la consulta al ejecutar: no asumir que sigue siendo la version recomendada ni que todos los usos del CLI activan el fallo.

#### S3.1: Diagnostico reproducible (primero)

- Consultar GitHub/aviso oficial y npm; registrar rango, parche, Node/peers, hashes y consumidores exactos.
- Guardar npm ls glob --all y un inventario del lock. Inspeccionar la API usada por Nest: glob.sync, opciones, tipos de retorno y normalizacion de rutas.
- Investigar por que los intentos anteriores no cambiaban la resolucion. Usar una copia aislada desde e4a6a10 con manifest y lock conocidos, sin node_modules previo. Distinguir una instalacion realmente corregida de una segunda copia nueva que deja 13.0.6 en uso.
- Herramientas: npm view/ls/audit, Node createRequire desde @nestjs/cli, parser JSON de lockfile y GitHub API en lectura. Verificar version resuelta por el consumidor, no solo la version del paquete en la raiz.

#### S3.2: Seleccionar cambio minimo (despues del diagnostico)

1. Preferir un parche oficial compatible de glob en la rama requerida o una version compatible de Nest CLI que ya use un glob corregido.
2. Si no existe esa combinacion, evaluar una resolucion selectiva del glob del CLI, solo si supera pruebas del contrato. No aplicar un override global a las copias antiguas de Jest.
3. Si el salto exige TypeScript/Nest de otra version mayor, o el paquete instalado sigue sin cambiar, no publicarlo como parche. Mantener S3 abierta y evaluar T11 por separado.

No elegir fast-glob o Node fs.globSync solo por similitud de nombre: tendrian que cubrir las opciones y resultados exactos del assets manager. No desarrollar un sustituto casero ni editar node_modules manualmente como solucion.

- **Archivos previstos:** package.json o apps/api/package.json segun consumidor, package-lock.json, scripts/verify-glob-security.cjs (nuevo solo al implementar), prueba de assets en entorno temporal y docs/VERIFICACION_S3_GLOB.md.
- **Librerias previstas:** glob oficial corregido y CLI actual/actualizacion compatible. No se instala nada en este paso documental; la version final se decide tras resolver compatibilidad.

#### S3.3: Pruebas necesarias

- Reproduccion acotada de la cancelacion con fixtures en directorio temporal, sin archivos privados. Proceso hijo con timeout/limite de recursos. Medir si se detiene el recorrido, no solo si la promesa rechaza.
- Comparar conjuntos de rutas del assets manager antes/despues: includes/excludes, globstar, dotfiles, paths con espacios, Windows/POSIX, carpetas vacias, multiples coincidencias y paths absolutos/relativos usados realmente.
- Compilar un proyecto Nest de prueba con assets configurados; comprobar que copia exactamente los mismos archivos y conserva estructura. El proyecto principal actual puede no ejercitar esos caminos: un build normal por si solo no prueba compatibilidad de assets.
- Probar arranque/paro del watcher de assets si la API utilizada cambia; cerrar solo los procesos creados por el ensayo.
- Instalacion limpia desde lock y require resuelto desde Nest apuntando a version corregida, sin la copia vulnerable de esa cadena.
- Lint, suite API completa y build API; build web/E2E si cambian dependencias compartidas. Mantener el descubrimiento completo de tests, sin desactivar controles.
- Repetir npm audit completo y --omit=dev. Registrar restantes en lugar de afirmar cero global por un cero de runtime.

#### S3.4: Cierre y limite de alcance

- Resultado local listo solo cuando desaparezca la ruta vulnerable realmente usada y pasen pruebas. El aviso GitHub solo se da por cerrado despues de push autorizado y reevaluacion confirmada.
- Si se confirma que no hay solucion pequena compatible, cerrar el informe como bloqueado/pendiente de migracion, no repetir overrides sin evidencia. S2 puede publicarse por separado: no dejar indefinidamente la correccion de deepmerge esperando una migracion grande.
- Rollback acotado: manifest/lock de S3; no tocar BD, configuracion Render ni runtime comercial. Volver a una version vulnerable es rollback operativo, no correccion.

## Prioridades y orden de ejecucion

Actualizacion de prioridad 2026-11-17: cerrar parche compatible de Next (S4)
antes de migraciones opcionales; S5 picomatch permanece abierta sin parche
oficial. Mantener T11/T13/T14 como evaluaciones, no reemplazos automaticos.

### S4: avisos Next de cache

- Estado 2026-11-17: verificado localmente con Next 16.4.6, instalacion limpia,
  lint/builds, 303 tests API y 40 E2E aprobados; runtime audit 0. Sin publicar.

- Aplicar Next 16.4.6, misma rama y Node/React compatibles; alinear plugin Next
  y declararlo donde lo importa ESLint. Sin cambiar reglas o logica de negocio.
- Comprobar version realmente instalada, lock reproducible, lint, builds y
  E2E de imagenes, sondeo, promociones y smoke desktop/mobile.
- Separar auditoria runtime de completa. Sin commit/push sin autorizacion.

### S5: picomatch / GHSA-fc5q-39xc-vjpf

- Estado 2026-11-17: abierto, sin parche oficial; 50 nodos high de desarrollo
  en audit completo. No descartado ni sustituido por una version vulnerable.

- Confirmar versiones y consumidores; aviso actual <=4.0.7, sin parche publicado.
- No seguir downgrades de npm ni aliases a contratos distintos. Documentar
  mitigacion y exposicion de herramientas; no marcar la vulnerabilidad resuelta.
- Reconsultar upstream/backports y evaluar alternativas solo con equivalencia
  probada. No ejecutar repro de ReDoS contra el servidor de ventas.

| Orden | Trabajo | Motivo / criterio |
| --- | --- | --- |
| 1 | Preservar S2 verificada y separar su diff de S1/T11 | Evitar perder o mezclar lo ya terminado; no requiere rehacer pruebas sin cambios |
| 2 | S3.1 y S3.2: identificar y resolver glob del CLI | Es el aviso pendiente concreto; primero probar un parche compatible |
| 3 | S3.3: validar seguridad, assets y herramientas | No basta instalar una version al lado de la vulnerable |
| 4 | Preparar seguridad publicable | S2+S3 juntas si ambas pasan; S2 sola si S3 exige migracion grande. Commit/push solo cuando el usuario lo indique |
| 5 | Revisar estado real de S1 en GitHub/npm | No asumir que las alertas historicas siguen abiertas ni actualizar ramas sin necesidad verificada |
| 6 | T11 y siguientes, solo con evidencia | Migraciones de herramientas son separadas; no requisito automatico de cada parche |

Render es exclusivamente responsabilidad del usuario. El agente prepara codigo, pruebas e informes y sube a GitHub solo con autorizacion. Reportes/CRM permanecen pausados hasta terminar o delimitar este trabajo de seguridad.

## Done (validacion final)

- [ ] Estado actualizado de S1/S2/S3 y arbol transitivo documentado.
- [ ] Cambio minimo por alerta, con prueba ligada al fallo y compatibilidad del consumidor.
- [ ] Instalacion reproducible desde lock y sin alterar librerias ajenas.
- [ ] npm audit completo y --omit=dev registrados, con pendientes visibles.
- [ ] Lint, pruebas y builds pertinentes pasan; reportar limites de pruebas locales.
- [ ] git diff --check y revision de staging sin secretos ni artefactos ajenos.
- [ ] Informe antes/despues y rollback por alerta; rollback vulnerable no descrito como solucion final.
- [ ] Commit/push solo tras autorizacion; Render exclusivamente a cargo del usuario.
- [ ] Despues del push, confirmar reevaluacion de GitHub; no cerrar manualmente avisos para aparentar exito.

Estado 2026-11-04: S1 parcialmente implementada y verificada localmente para minimatch moderno; rama 3.1.5 y aviso adicional de glob siguen pendientes. Ver docs/VERIFICACION_S1_MINIMATCH.md. Sin commit/push. S2 no iniciada.

Actualizacion 2026-11-11: S2 implementada localmente con @stackline/deepmerge 1.1.2, tras revisar su API y reproducir el fallo/diferencias contra el original. Las pruebas de consumidores, API y builds pasan. Ver docs/VERIFICACION_S2_DEEPMERGE.md. Sin commit/push; no declarar cerrada #40 hasta verificar GitHub. Los informes anteriores de ausencia de alternativa corresponden a la investigacion de esas fechas, no al estado actual.

## Referencias

- https://github.com/advisories/GHSA-g3hv-75wg-m249
- https://github.com/advisories/GHSA-gcqx-w48m-w2h4
- https://github.com/advisories/GHSA-3g3m-2fjr-6pw4
- specs/estabilidad-produccion-fase2.md
- docs/SEGURIDAD_DEPENDENCIAS_2026-10-31.md
