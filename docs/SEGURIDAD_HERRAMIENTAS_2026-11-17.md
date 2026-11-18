# Continuacion de seguridad y herramientas

Fecha: 2026-11-17. Trabajo local; sin commit, push ni operaciones Render.

## Estado y prioridades

La auditoria completa de hoy encontro 51 nodos afectados: 50 high y 1 moderate.
No son 51 vulnerabilidades independientes: picomatch propaga un mismo aviso por
Jest, ESLint y herramientas Nest; Next agrupa dos avisos propios.

1. S1/S2/S3: conservar los parches locales verificados. Se agrega
   `npm run test:toolchain` para ejecutar las cuatro comprobaciones con parada
   ante fallo: minimatch, deepmerge, glob y compilacion/copia/watcher Nest.
2. S4 Next: aplicar parche de la rama 16.4, verificar resolucion efectiva,
   lint/build/E2E y auditoria runtime. No cambiar React, TypeScript ni logica.
3. S5 picomatch: investigar alcance y soluciones compatibles, manteniendo
   explicitamente abierta la vulnerabilidad hasta disponer de una correccion.
4. T11-T14: no convertir una alerta sin parche en una migracion precipitada.

## S4: Next

- GHSA-mfr8-8qww-v76h: >=16.3.0 <=16.4.4; corregido en 16.4.5.
- GHSA-vc7v-qv4w-wrv8: >=16.2.0 <=16.4.4; corregido en 16.4.5.
- Candidato: 16.4.6, admite Node >=20.9 y React 19 (se mantiene Node 22.19.0).
- No se localizaron referencias a unstable_cache, use cache ni cacheComponents
  en la aplicacion. Esto limita la evidencia de exposicion, no demuestra que
  cualquier ruta sea inexplotable y no sustituye el parche.
- El plugin de lint 16.4.6 se declara en la raiz porque eslint.config.mjs lo
  importa alli. Antes dependia de hoisting incidental desde apps/web; la
  actualizacion revelo ERR_MODULE_NOT_FOUND. No se modifican reglas de lint.
- Instalacion y verificacion final completadas localmente: Next, @next/env y
  plugin 16.4.6. Se detecto que npm retenia Next 16.4.2 y se reconcilio el lock
  antes de aceptar resultados. Instalacion limpia confirma la resolucion.

## S5: picomatch

- GHSA-fc5q-39xc-vjpf, severidad high, ReDoS con extglobs repetidos.
- Aviso oficial actualizado el 17: versiones <=4.0.7; sin version corregida.
- Registro npm: ultima version publicada 4.0.7; 4.0.8 responde E404.
- Arbol local: 4.0.4 mediante Angular devkit/Nest, tinyglobby/fdir; 2.3.2
  mediante anymatch, jest-util y micromatch/fast-glob/plugin Next.
- No se encontraron imports directos de picomatch/micromatch en apps o scripts.
- No aplicar sugerencias de downgrade automatico de npm (ts-jest 26 o
  schematics 10), ni override global a una version que tambien esta afectada.
- Mitigacion operativa: ejecutar herramientas solo con codigo/configuraciones
  de confianza; no incorporar patrones del cliente a tareas de lint/build/test;
  no ejecutar contribuciones desconocidas con secretos. No es una correccion.
- Proxima investigacion: contrastar parche upstream/backports y contratos de
  cada consumidor; solo evaluar sustitucion si conserva APIs y pasa regresion.

## T12: conclusion revisable

La limpieza T10 de eslint-config-next ya esta publicada en e4a6a10 (ver log
local), no sigue pendiente de aplicar como indicaban notas anteriores.
Mantener Nest CLI por ahora: no se identifico postgres/pg_ctl/psql en PATH ni
servicio PostgreSQL local. Falta validar arranque real Nest/Prisma con BD
aislada; no se usara produccion ni se instalara WSL/Docker.
T13 (Oxlint) y T14 (Vitest) siguen pendientes de comparacion, no aprobados como
reemplazos. No hay evidencia suficiente para prometer equivalencia o ahorro
de RAM del servidor al migrarlos.

## Resultados del cierre local

- `npm run test:toolchain`: codigo 0; contratos de minimatch/deepmerge,
  cancelacion glob, assets y watcher Nest aprobados.
- `npm run lint`: API y web aprobados; no se desactivan reglas.
- `npm run build`: API y web aprobados con Next 16.4.6.
- Suite API: 33 suites, 303 tests aprobados.
- E2E seleccionados: 40 aprobados (2.0 minutos), escritorio y movil. Incluyen
  imagenes, sondeo, promocion/precio en carrito, registro/sesiones, checkout y
  seguimiento con API y pago simulados. No son ventas reales ni prueba de carga.
- `npm ci --ignore-scripts --no-audit --no-fund` en copia temporal nueva:
  899 paquetes, codigo 0; no se ejecutan hooks de instalacion en ese ensayo.
  `npm ls next @next/eslint-plugin-next glob --all` codigo 0. Next/env/plugin
  16.4.6, glob del CLI 14.0.5. No se certifica arranque de API/BD en esa copia.
- Auditoria runtime: 0 avisos.
- Auditoria completa: 50 nodos high, todos derivados del aviso picomatch.
  Next ya no aparece. No afirmar cero global ni cierre de alertas GitHub.
- Se preservan los metadatos glibc de Sharp Linux y los cambios S1/S2/S3.
- Las pruebas registran 404 de imagenes/iconos de fixtures y un rechazo de
  compresion invalida en el test HTTP; no equivalen a consola limpia ni a
  comprobacion de recursos reales de produccion.

Evidencia resumida:

```text
Test Suites: 33 passed, 33 total
Tests:       303 passed, 303 total
40 passed (2.0m)
Next 16.4.6 env 16.4.6
Root lint plugin 16.4.6
```

La copia temporal final es
`%TEMP%/mordida-next-ci-b0fa4c31ce38497996502bac1fcf0004`.
Sin secretos copiados, enlaces a node_modules, commit, push ni despliegue.

Pendientes reales: S5 sin parche oficial, cierre remoto tras publicacion
autorizada, y evaluaciones T11/T13/T14. No son requisito para aplicar el parche
de Next, pero no deben etiquetarse como migraciones terminadas.

## Fuentes

- https://github.com/advisories/GHSA-g3hv-75wg-m249
- https://github.com/advisories/GHSA-mfr8-8qww-v76h
- https://github.com/advisories/GHSA-vc7v-qv4w-wrv8
- https://github.com/advisories/GHSA-fc5q-39xc-vjpf
