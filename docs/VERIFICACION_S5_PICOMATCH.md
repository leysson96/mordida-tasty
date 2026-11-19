# S5.1: diagnostico de picomatch

Actualizacion documental: 2026-11-19 10:03:19 +01:00 (Europe/Madrid).
Audit completo/runtime repetidos hoy entre 10:02:58 y 10:03:03 +01:00:
ambos exit 0, cero avisos. Cierre local sin parche picomatch; no se comprobo
Dependabot privado. Ver [cierre](./CIERRE_NPM_2026-11-19.md).

## Resultado mas reciente del 2026-11-18

Una nueva consulta, posterior a la discrepancia descrita abajo, devolvio
`npm audit --json` exit 0 con 0 vulnerabilidades y `npm audit --omit=dev
--json` exit 0 con 0 vulnerabilidades. Picomatch instalado NO cambio.
Esto es consistente con la retirada del aviso en GitHub; no se afirma haber
demostrado el mecanismo interno de sincronizacion de los registros.

La discrepancia local queda despejada y no se justifica sustituir picomatch
por ese aviso retirado. No se ha verificado el estado de las alertas privadas
del repositorio. Cero avisos conocidos no significa ausencia de todos los
errores ni diagnostica las caidas de Render.

Se corrigio aparte un incumplimiento de rangos de las dependencias de glob;
ver [revision S3](./VERIFICACION_S3_GLOB.md). Esa correccion es local y requiere
publicacion autorizada; no es un parche de picomatch. Las secciones siguientes
conservan el diagnostico y la respuesta de npm anteriores de este mismo dia.

## Archivo historico: primera consulta antes de desaparecer el aviso en npm

Los 50 avisos y las discrepancias descritos a continuacion pertenecen a esa
primera consulta. El resultado vigente es el de la cabecera: npm completo y
runtime 0. No interpretar el relato historico como un bloqueo local actual.

Fecha: 2026-11-18. Base publicada 0d34e9f. Solo lectura de dependencias y
documentacion; sin cambios de manifest/lock/codigo, instalaciones, commit o push.

## Aviso oficial y registro

GitHub Advisory Database marca GHSA-fc5q-39xc-vjpf como Withdrawn desde el
18 de noviembre. Mantiene el rango historico <=4.0.7 y no publica una version
corregida. El texto de retirada tiene una redaccion ambigua: no se utiliza
para afirmar que desaparecio cualquier riesgo tecnico.

La referencia es picomatch PR #235. El mantenedor cuestiona la clasificacion
del aviso y recomienda no aceptar patrones de usuarios no confiables. La PR
esta cerrada, no incorporada como parche aprobado. No adoptar ese codigo como
correccion oficial ni prometer que evita cualquier ReDoS.

Fuentes consultadas:
- https://github.com/advisories/GHSA-fc5q-39xc-vjpf
- https://github.com/micromatch/picomatch/pull/235

`npm view picomatch version dist-tags --json`: latest 4.0.7.
`npm audit --json`: 50 nodos high, un aviso fuente, GHSA-fc5q-39xc-vjpf.
`npm audit --omit=dev --json`: 0 vulnerabilidades.

Hay discrepancia entre GitHub y npm. Puede ser propagacion/cache, pero no se
ha demostrado la causa ni un plazo de sincronizacion. No se descarta el aviso
manualmente ni se afirma cierre de Dependabot: no se consultaron las alertas
privadas del repositorio en esta ejecucion.

## Resolucion y contratos

Comprobados con npm ls, parser JSON del lock y createRequire desde cada
consumidor. Las cuatro copias del lock tienen dev=true.

| Consumidores | Copia | Uso inspeccionado |
| --- | --- | --- |
| Angular devkit/Nest CLI/schematics | raiz, 4.0.4 | parse(glob).output en sistema virtual de archivos |
| tinyglobby/fdir | raiz, 4.0.4 | matcher; tinyglobby usa scan e ignore |
| anymatch/Jest | anymatch/node_modules, 2.3.2 | matcher, opciones y negacion |
| jest-util/ts-jest | jest-util/node_modules, 2.3.2 | dot=true, estado negated/negatedExtglob |
| micromatch/fast-glob/plugin Next | micromatch/node_modules, 2.3.2 | matcher, parse, scan, makeRe, onResult y picomatch/lib/utils |

Las siete resoluciones consultadas exportan funcion y parse/makeRe/scan.
Esto no demuestra equivalencia entre ramas ni autoriza alias a otra libreria.

Archivos de dependencias inspeccionados:
- node_modules/@angular-devkit/core/src/virtual-fs/host/pattern.js
- node_modules/@nestjs/schematics/node_modules/@angular-devkit/core/src/virtual-fs/host/pattern.js
- node_modules/jest-util/build/globsToMatcher.js
- node_modules/anymatch/index.js
- node_modules/micromatch/index.js
- node_modules/tinyglobby/dist/index.cjs
- node_modules/fdir/dist/index.cjs

## Exposicion y limites

La busqueda en apps y scripts no encontro referencias directas a picomatch,
micromatch, tinyglobby o fast-glob. Jest configura `**/src/**/*.spec.ts`.
Los usos revisados corresponden a herramientas que reciben configuracion y
archivos del proyecto; no se identifico una ruta que entregue patrones de
clientes del restaurante a estos consumidores.

No es una prueba exhaustiva de flujo de datos ni de ausencia de codigo
vendorizado. Un cero de audit runtime tampoco garantiza seguridad universal.
Mantener configuracion/codigo de herramientas de confianza y no ejecutar
contribuciones desconocidas con secretos. No atribuir a este contador una
capacidad demostrada de bloquear el servidor de ventas.

## Decision

Revision adicional solicitada por el usuario: se volvio a consultar npm con
prefer-online; latest sigue en 4.0.7, audit completo mantiene 50 high y runtime
0. No se puede prometer una libreria libre de errores por ser mas reciente.
La revision de npm ls completo encontro una incoherencia separada en las
dependencias de glob, documentada y corregida localmente en
[S3](./VERIFICACION_S3_GLOB.md). No se cambia picomatch ni se presenta ese
ajuste como solucion al aviso retirado.

S5.1 completada. No actualizar a 4.0.7 como supuesto parche, introducir forks,
rebajar Nest/Jest ni silenciar alertas para conseguir verde.
La retirada oficial cambia la necesidad de S5.2: primero confirmar la
reevaluacion de npm/Dependabot. Si persiste el aviso, mantener la discrepancia
documentada, sin inventar una correccion.

No se ejecuto repro hostil ni carga contra Render. No se repitieron lint/build
o E2E: no cambio codigo ni dependencias. Estos resultados son diagnostico,
no evidencia de una correccion implementada.

S5 no se declara cerrada en el repositorio remoto. CRM/audio no se iniciaron;
consultar antes de avanzar al CRM bajo este cambio de situacion.
