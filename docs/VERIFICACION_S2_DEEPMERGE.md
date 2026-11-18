# S2: correccion local de deepmerge

Fecha: 2026-11-11. Base publicada: e4a6a10. Sin commit/push ni cambios Render.

## Decision y compatibilidad

deepmerge original sigue en 4.3.1 sin parche oficial publicado. Se consultaron tambien Jest y fork-ts-checker-webpack-plugin actuales: siguen requiriendo la API 4.x. No se migra Jest, Nest ni TypeScript.

Se encontro @stackline/deepmerge 1.1.2, un fork de otro mantenedor que declara compatibilidad con deepmerge 4 y correccion de CVE-2026-93753 / GHSA-gcqx-w48m-w2h4. No es una nueva version oficial del paquete original. Se revisaron su manifiesto, codigo distribuido de mezcla/proteccion de claves, exports y metadatos antes de integrarlo. Sin dependencias de runtime ni hooks install/postinstall; compatibilidad declarada Node >=14.17 y probada aqui con 22.19.0.

El paquete se descarga con scripts desactivados y se comprueba SHA-512 contra la integridad del registro:

sha512-jJIukhO8oDuqYZ/LEcnfB3gFem15gv+0jxSWVWad+c9bEP2pL5SzU2PAlQKHHGKw0qddTGpclgnZUaY3CMukxg==

Se fija una version exacta mediante override:

```json
"deepmerge": "npm:@stackline/deepmerge@1.1.2"
```

No es un alias entre APIs diferentes para silenciar audit: los imports existentes resuelven una implementacion compatible, cuya correccion se verifica reproduciendo el fallo original. Aun asi se incorpora otro mantenedor y su cadena de suministro; el pin y la revision reducen variabilidad, no son garantia absoluta de seguridad futura.

## Pruebas del fallo y del contrato

scripts/verify-deepmerge-security.cjs:

- La version original, conservada solo como artefacto de ensayo fuera de dependencias, reproduce un prototipo contaminado al recibir una clave propia __proto__ en el target.
- El candidato rechaza esa clave tanto en target como en source, objetos anidados y arrays. Se comprueba el prototipo del resultado y que Object.prototype no se contamina.
- Casos constructor/prototype, simbolos, fechas, regex, objeto sin prototipo, arrays, clone=false, referencias clonadas, arrayMerge, customMerge, isMergeableObject y merge.all.
- 109 casos diferenciales contra 4.3.1 pasan para entradas legitimas seleccionadas; no constituye una prueba exhaustiva de todas las extensiones posibles.
- Verificacion instalada desde los cuatro consumidores reales: fork-ts-checker-webpack-plugin, @jest/core, jest-cli y create-jest. Todos resuelven el fork y pasan la prueba del prototipo.
- apps/api/src/common/deepmerge-security.spec.ts incorpora la regresion al runner de la API. La prueba no modifica datos ni hace peticiones a produccion.

Las caracteristicas adicionales del fork (colecciones, presets estrictos, etc.) no se activan. No se sustituyen consumidores ni se cambian reglas de configuracion del restaurante.

## Resultados

- Suite API completa: 32 suites / 302 tests pasan tras la sustitucion.
- Nueva prueba deepmerge-security, ejecutada despues: 1/1 pasa; total de casos verificados 303 entre ambas ejecuciones.
- Lint API/web: pasa; lint API repetido tras agregar la regresion.
- Build API y web: pasan.
- Integridad del tarball: coincide.
- npm ls deepmerge --all: cuatro resoluciones a @stackline/deepmerge 1.1.2, ninguna copia del original 4.3.1 en el arbol instalado.
- npm audit: ya no incluye deepmerge; conserva dos nodos moderados derivados del aviso de glob. No se afirma que toda la auditoria este limpia.
- npm audit --omit=dev: cero vulnerabilidades.

El worktree conserva el experimento S1 previo (minimatch moderno); no se incluye como parte de esta solucion ni se cambia. Al preparar un commit, aislar el cambio deepmerge y el lock correspondiente, sin publicar experimentos ajenos por accidente.

## Instalacion reproducible

Instalacion temporal nueva desde los manifests y lock actuales mediante npm ci --ignore-scripts: 899 paquetes instalados, exit 0. La verificacion posterior carga la dependencia desde esa instalacion, no desde node_modules del proyecto: los cuatro consumidores resuelven el fork y pasan seguridad/contrato; tambien pasan los 109 casos comparativos con el original. ignore-scripts no certifica los hooks de otras librerias. La carpeta temporal es mordida-deepmerge-clean-0f4fad5a37eb46eb9cea062532899368 dentro del sandbox temporal de la sesion.

## Publicacion pendiente

El estado de GitHub #40 no se cambia manualmente. Hasta subir un commit autorizado y comprobar la reevaluacion, no se declara cerrada la alerta remota. El usuario controla el despliegue Render.

No requiere variables ni migraciones. No se cambian T1-T3, precios, sesiones, pedidos, BD, reglas de efectivo ni UI. No se repitio E2E de negocio al cambiar solo una dependencia de herramientas; la compatibilidad de sus consumidores se ejercito en Jest y compilacion real.

Rollback: retirar solo el override deepmerge y las entradas asociadas del lock, y reinstalar. Eso reintroduce el aviso original; no tratarlo como solucion de seguridad.

Fuentes:
- https://github.com/alexandroit/stackline-deepmerge
- https://github.com/alexandroit/stackline-deepmerge/blob/main/docs/COMPATIBILITY.md
- https://github.com/advisories/GHSA-gcqx-w48m-w2h4
