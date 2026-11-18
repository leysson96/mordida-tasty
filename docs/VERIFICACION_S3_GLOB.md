# S3: diagnostico de glob

Fecha: 2026-11-12. Estado: S3 integrada y verificada localmente; sin publicar.
Sin commit, push ni cambios en Render. S2 permanece intacta.
La primera seccion conserva el diagnostico inicial; la integracion posterior
se documenta al final.

## Evidencia

- Proyecto: Nest CLI 11.0.24 consume glob 13.0.6; Jest usa glob 7.2.3.
- Nest usa `glob.sync` con `ignore` y `dot` para copiar assets y preparar
  watchers. El fallo de cancelacion no demuestra una fuga en el servidor web.
- npm publica glob 13.0.7 y 14.0.5. Ambos admiten Node 22.19.0.
- El tarball oficial 13.0.7 contiene `return cb()` en las cuatro ramas de
  cancelacion del walker. Integridad publicada:
  `sha512-wfsFgXQ8A3SEI9XGf7Nl3Y9l7ffSrGh7SUCT7vU/2CzYPep9kjxAn1S40F9OPKxAMGCVl7HtNlJhrCJUeUq83g==`.
- El aviso oficial sigue declarando >=9 <=14.0.1 vulnerable y 14.0.2 como
  parche. npm audit tambien marca 13.0.7. No se oculta ni descarta esa alerta.

## Ensayo aislado

Manifest: [ensayo](../audit-artifacts/glob-review/package.json).
Instalacion nueva, sin scripts de paquetes ni enlaces a node_modules del proyecto.
Se instalo Nest CLI 11.0.24 con override exclusivo de su glob; baseline
`glob-baseline` es alias de 13.0.6, solo para reproducir el fallo.

Primero se ensayo 13.0.7; despues se cambio el candidato a 14.0.5.
Ambos se resuelven desde `createRequire` del CLI. Esto demuestra que npm
acepta el override en un arbol aislado, pero NO explica aun por completo por
que los intentos previos con el lockfile del monorepo retenian 13.0.6.
No atribuirlo a un shrinkwrap: no se encontro uno dentro del CLI instalado.

Comando reproducible:

```powershell
node scripts/verify-glob-security.cjs audit-artifacts/glob-review --baseline
```

| Version | Lecturas totales | Al rechazar | Nuevas tras rechazo | Seleccion |
| --- | --- | --- | --- | --- |
| 13.0.6 baseline | 6 | 5 | 1 | 4 casos pasan |
| 13.0.7 | 1 | 1 | 0 | 4 casos pasan |
| 14.0.5 | 1 | 1 | 0 | 4 casos pasan |

Prueba: [verify-glob-security.cjs](../scripts/verify-glob-security.cjs).
Cada version corre en un proceso hijo limitado a 128 MB/10 segundos, con un
arbol temporal pequeno sin datos privados. Se cancela al completar la primera
lectura y se comprueba que no continua el recorrido. Incluye dotfiles,
exclusiones, globstar, espacios, rutas absolutas/relativas y cero coincidencias.
Solo ejecutada en Windows. No representa todas las carreras posibles ni una
prueba de carga de produccion.

El npm audit del ensayo con 13.0.7 devolvio 5 nodos afectados (2 low, 3 moderate):
incluye baseline vulnerable, minimatch y deepmerge originales porque el ensayo
no aplica S1/S2. No confundir ese resultado con el audit del proyecto principal.

## Decision y siguiente paso

14.0.5 es el candidato para la siguiente validacion: pasa el repro y queda
fuera del rango del aviso. No se adopta solo por esos dos criterios.

1. Reproducir la resolucion con los manifests y lock completos en entorno limpio;
   ajustar solo la cadena del CLI, preservando S1/S2 y metadatos Sharp Linux.
2. Compilar fixture Nest con assets y comparar archivos copiados con baseline.
3. Comprobar watcher si cambia la API utilizada; probar cierre sin procesos vivos.
4. Ejecutar lint, suite API y builds pertinentes, instalacion limpia y audit
   completo/runtime. Revisar el diff y cualquier dependencia compartida.
5. Solo entonces preparar cierre S3. Commit/push requieren autorizacion.

`git diff --check` paso en este ensayo. No se han repetido lint ni builds:
no se cambiaron dependencias de la aplicacion. No hay evidencia para declarar
cerrada la alerta GitHub ni listo el despliegue.

Fuente: https://github.com/advisories/GHSA-3g3m-2fjr-6pw4

## Integracion posterior en el monorepo

- Se aplica override exclusivo `glob@13.0.6 -> 14.0.5`; glob 7.2.3 de Jest
  permanece intacto. No cambia la version de Nest CLI (11.0.24).
- `npm update glob` y refrescar el CLI no modificaban la resolucion heredada.
  Una resolucion nueva con los mismos manifests si obtenia 14.0.5. Se utilizo
  su metadata de glob (version, URL, integridad y dependencias), sin importar
  las actualizaciones ajenas de ese lockfile completo.
- Mientras el CLI estaba anidado en apps/api/node_modules, npm ls reportaba
  glob invalido a pesar del override y de pasar las pruebas. Reubicar las dos
  entradas del mismo CLI y su @inquirer/prompts al node_modules raiz y dejar
  que npm reconcilie la instalacion elimina el error. Ambos conservan version.
  Es evidencia del comportamiento del arbol heredado/npm 10.9.3, no una
  afirmacion de haber identificado el bug interno exacto de npm.
- Se preservan metadatos libc de los dos paquetes Sharp Linux: npm en Windows
  los elimina al reconciliar; se restauraron antes de la instalacion final.
- `npm ls glob --all` termina con codigo 0; Nest carga 14.0.5 mediante
  createRequire desde el consumidor. El repro de cancelacion pasa.

### Compatibilidad de assets

[verify-nest-assets.cjs](../scripts/verify-nest-assets.cjs) crea un proyecto
temporal y ejecuta el CLI real con timeout. Comprueba TypeScript compilado,
cinco archivos con contenido y estructura exactos, dotfile, espacios,
subdirectorios, exclusion y patron sin coincidencias. Luego prueba copia
inicial, modificacion, borrado y cierre de un watcher real de AssetsManager.
No utiliza BD, WSL, Docker ni archivos privados.

La compilacion con patrones explicitos paso antes con 13.0.6 y despues con
14.0.5. El watcher paso con 14.0.5. Se observo una limitacion existente de Nest
en Windows al incluir una carpeta literal sin patron: error "Path outside of
project folder is not allowed" en AMBAS versiones. Usar `directory/**/*` en el
fixture funciona. No se ha modificado Nest ni ocultado ese caso como aprobado;
el proyecto real no tiene assets configurados en nest-cli.json.

### Verificacion realizada

- `npm run lint`: API y web, codigo 0.
- Suite API: 33 suites, 303 tests aprobados. Incluye S2 deepmerge.
- `npm run build`: API y web aprobados.
- `npm audit --json`: cero vulnerabilidades en el arbol completo local.
- `npm audit --omit=dev --json`: cero vulnerabilidades de runtime local.
- Instalacion limpia final: `npm ci --ignore-scripts --no-audit --no-fund`,
  899 paquetes, codigo 0. No se ejecutaron lifecycle scripts en esa copia.
  `npm ls glob --all` termina con codigo 0 y Nest resuelve 14.0.5. Las pruebas
  de cancelacion, compilacion con assets y watcher tambien pasan en esa copia.
- E2E: `polling-resilience`, `image-delivery`, `promotion-pricing` y
  `mordida-smoke`: 40 aprobados en escritorio/movil, 1.5 minutos. API/pago
  simulados; no se verifican cobros ni produccion. Hay avisos de LCP y 404 de
  imagenes/iconos de fixtures en la salida; no afirmar consola sin errores.
- `git diff --check`: codigo 0. Cambios ajenos preexistentes no se alteran.

Salida resumida literal de las herramientas:

```text
Test Suites: 33 passed, 33 total
Tests:       303 passed, 303 total
40 passed (1.5m)
Version: 14.0.5
{"baseline":false,"compatibilityCases":4,"reads":1,"atReject":1,"readsAfterReject":0}
```

Comandos para repetir los checks propios desde la raiz:

```powershell
node scripts/verify-glob-security.cjs
node scripts/verify-nest-assets.cjs
npm.cmd ls glob --all
```

El ensayo temporal final esta en
`%TEMP%/mordida-glob-ci-d125632444474e678d739477d0ade11b`;
no tiene secretos ni enlaces a dependencias de produccion.

Estos resultados locales no confirman el cierre remoto de alertas ni el estado
de Render. No se modifican pedidos, precios, sesiones ni el codigo de runtime.
