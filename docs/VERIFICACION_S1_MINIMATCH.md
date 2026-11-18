# S1: actualizacion selectiva de minimatch

## Actualizacion 2026-11-17 (prevalece sobre el informe historico)

El aviso oficial GHSA-g3hv-75wg-m249 ahora delimita las versiones afectadas a
`>=7.0.0 <11.0.1`. Por tanto, las copias 3.1.5 no son un pendiente de ESTE aviso.
Se conserva su API invocable y se verifican las ramas modernas 11.0.4.
`npm run test:toolchain` pasa con el arbol local. S2 y S3 tambien estan corregidas
localmente; no se afirma cierre remoto. El texto siguiente conserva la evidencia
historica y NO describe la auditoria actual.

La auditoria completa del 17 detecta otros avisos (Next y picomatch), registrados
en [seguimiento actual](./SEGURIDAD_HERRAMIENTAS_2026-11-17.md). No presentar el
cero de vulnerabilidades del dia 12 como estado actual.

Fecha: 2026-11-04. Base 267fa01. Solo local; sin commit/push ni acciones en Render.

## Resultado: parcial, alerta no cerrada

Se sustituyen las resoluciones modernas 10.2.6 por 11.0.4 mediante override limitado a minimatch >=10 <11. Consumidores: glob 13.0.6 (CLI Nest) y @typescript-eslint/typescript-estree 8.71.0. La version 11.0.4 consultada requiere Node 20 o >=22 y admite el Node 22.19.0 del proyecto.

No se fuerza 11 sobre la rama 3: ESLint, Jest/glob 7, plugins ESLint y fork-ts-checker-webpack-plugin siguen requiriendo la exportacion invocable de 3.1.5. El registro consultado no ofrece backport 3.x posterior. ESLint latest consultado todavia depende de minimatch 10.2.6; actualizar todas las herramientas por su nombre latest no elimina todas las rutas afectadas.

El aviso GHSA-g3hv-75wg-m249 declara vulnerable todo <11.0.1, aunque describe el algoritmo moderno con optimizationLevel >=2. No se ha marcado como falso positivo la rama 3 ni cerrado ninguna alerta. GitHub no recibe cambios en esta tarea.

## Archivos y alcance

- package.json: override selectivo.
- package-lock.json: elimina resolucion moderna 10.2.6, agrega dos resoluciones 11.0.4 y @isaacs/nonrecursive-glob-match 1.0.3 requerido por esa version.
- scripts/verify-minimatch-security.cjs: contratos modernos, API antigua preservada, descubrimiento de tests y patrones acotados en proceso hijo.

Se conservaron metadatos libc/glibc de Sharp y se descartaron cambios incidentales de deduplicacion no necesarios. No se cambio la aplicacion, BD, precios, sesiones ni UI.

## Evidencia local

- Script de verificacion: glob y typescript-estree resuelven 11.0.4; casos globstar, extension, dotfiles, negacion, braces y rutas Windows pasan. ESLint sigue recibiendo una funcion 3.1.5.
- Patrones **/../ repetidos de longitud 4, 8, 12 y 16: terminan con una expansion y aproximadamente 0-2 ms por caso. Proceso hijo limitado a 128 MiB de heap y timeout de 5 s. Es un corpus acotado, NO una demostracion de todas las entradas adversarias ni comparacion cronometrada con 10.2.6.
- Lint API/web: pasa.
- API: 32 suites, 302 tests pasan; no se redujo el descubrimiento de pruebas.
- Builds API y web: pasan.
- npm ci --ignore-scripts en carpeta temporal nueva con manifest y lock copiados: instala 1039 paquetes. Se verifica la resolucion de ambas ramas en ese entorno, sin borrar dependencias del workspace. Esta prueba comprueba resolucion/lock; no ejecuta scripts nativos de instalacion ni tests de aplicacion dentro de la carpeta temporal.
- No se repitieron E2E de negocio porque no hay cambio de runtime/UI; los consumidores modificados se ejercitan con lint, compilacion y tests.

## Aviso adicional descubierto

npm audit tambien detecta glob GHSA-3g3m-2fjr-6pw4 (cancelacion por AbortSignal, >=9 <=14.0.1). Existe glob 14.0.3, pero el CLI instalado fija 13.0.6 y los intentos de override/update no cambiaron esa resolucion. Se retiro el override sin efecto y NO se declara corregido glob. Evaluar por separado actualizacion del CLI/consumidor o un override reproducible y probado; no dejar una version aparente en manifest con otra realmente instalada.

## Pendientes

Revision adicional tras pedir resolver todo antes del commit: el registro sigue sin backport 3.x ni parche deepmerge. Se probaron resoluciones selectivas de glob, incluido recalcular el CLI con su misma version y usar una dependencia de desarrollo explicita: ninguna sustituyo la copia 13.0.6 usada por el CLI. Todos esos intentos se retiraron, junto con cambios de manifest/lock incidentales. La verificacion final vuelve a confirmar solo minimatch moderno 11.0.4 para glob/typescript-estree y runtime sin avisos. No se crea commit como cierre completo mientras persistan estas alertas; hacerlo se interpretaria erroneamente como cumplimiento de la condicion de resolver todo.

- #42 no completamente resuelta: siguen copias 3.1.5.
- glob 13.0.6 conserva aviso adicional.
- deepmerge #40 sin cambios, corresponde a S2.
- Auditoria runtime excluyendo dev: cero vulnerabilidades en la ultima consulta de esta ejecucion. Auditoria completa conserva avisos de desarrollo; no equivale a proyecto globalmente limpio.
- Buscar consumidores realmente compatibles que eliminen las ramas antiguas; no forzar alias ni downgrade para silenciar el analizador.

Referencias oficiales consultadas:
- https://github.com/advisories/GHSA-g3hv-75wg-m249
- https://github.com/isaacs/minimatch/releases/tag/v11.0.1
- https://github.com/advisories/GHSA-3g3m-2fjr-6pw4

Rollback local del cambio propuesto: retirar el override y restaurar solo sus entradas de lock desde la base, reinstalando dependencias. Reintroduciria la rama moderna vulnerable, por lo que no es una correccion de seguridad.
