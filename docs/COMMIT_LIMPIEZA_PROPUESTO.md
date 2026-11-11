# Propuesta de commit unico: limpieza verificada

Preparado: 2026-11-10. Base: 267fa01841ab3d947a754d7941f315e3cb51271a.

## Alcance exacto

1. apps/web/package.json: retirar solo eslint-config-next, que no se importa en la configuracion efectiva actual.
2. package-lock.json: eliminar sus dependencias no necesarias, sin cambiar versiones compartidas ni incorporar el override experimental de minimatch.
3. e2e/promotion-pricing.spec.ts: fijar la fecha del navegador dentro del periodo de la fixture. No cambiar las reglas o fechas de promociones reales.
4. Este documento: alcance, verificacion y limites.

Mensaje propuesto: chore(web): retira configuracion lint no utilizada

## Separacion del trabajo pendiente

El package-lock.json del worktree principal mezcla la limpieza con S1. NO incluirlo directamente en este commit. El lock exacto que se valida para esta propuesta esta en:

audit-artifacts/release-cleanup/1794308947099/candidate-package-lock.json

El candidato se extrajo desde git archive de la base, copiando solo los dos archivos de fuente indicados. No copia .env ni las modificaciones/artefactos ajenos del worktree. El script aborta si detecta cambios de version de dependencias compartidas al resolver la limpieza.

Fuera del commit:

- package.json raiz y el override experimental de minimatch.
- Scripts/artefactos comparativos de compilador, watch o memoria.
- Migracion Nest CLI -> tsc, cambios de ESLint -> Oxlint o Jest -> Vitest.
- Documentos de hoja de ruta pendientes y capturas de tareas anteriores.
- Cambios de precios, sesiones, pedidos, promociones reales, BD o configuracion Render.

## Verificacion independiente

Script reproducible de preparacion: scripts/prepare-cleanup-candidate.mjs (herramienta local de evaluacion, no incluida en el commit minimo).

Evidencia: audit-artifacts/release-cleanup/1794308947099/.
Los logs/result.json indican los pasos realmente completados; no dar por validado un paso si falta o tiene exit distinto de cero. El cliente Prisma se genera con una URL local ficticia, sin conectar a una BD; no hay migrate, seed, pagos ni correos reales.

La comparacion previa de reglas efectivas de ESLint conserva las mismas 24/24/2 entradas para los archivos representativos. No se afirma que retirar un paquete aumente controles de lint: conserva los existentes y reduce dependencias.

### Resultados del candidato exacto

- Instalacion limpia npm ci --ignore-scripts: correcta.
- Prisma generate (sin conexion a BD): correcto.
- Lint API/web: correcto.
- API: 32 suites / 302 tests correctos.
- Build API: correcto.
- Navegador: primera pasada 39/40 con timeout en checkout efectivo desktop; se repitio ese caso tres veces (3/3) y despues la suite completa (40/40). No se modifico codigo, timeout ni aserciones para conseguirlo. La causa del timeout inicial no se demostro; se conserva el log e2e.log de la primera ejecucion y se registra como intermitencia observada, no se borra del informe.
- Build web de la copia aislada: correcto.
- Auditoria npm de runtime: cero vulnerabilidades; esto no afirma que el arbol de desarrollo este libre de avisos.
- Verificacion del lock: sin cambios de version de paquetes compartidos; 906 entradas; no contiene eslint-config-next ni incorpora el override experimental.
- El runner inicial se detuvo por el fallo E2E y no genero result.json. La verificacion se completo con comandos dirigidos en la misma copia, segun los resultados anteriores; no inferir exito de un archivo ausente.

Parche preparado: audit-artifacts/release-cleanup/1794308947099/cleanup-only.patch. Contiene solo manifest web, lock candidato y reloj del test. El 2026-11-11 se vuelve a comprobar sobre 267fa01 y se prepara en staging junto con este documento, sin crear commit ni hacer push. El lock del worktree conserva S1; el lock del indice contiene solo la limpieza verificada.

## Estado de tareas

| Tarea | Estado |
| --- | --- |
| T10 inventario/limpieza | Cambio local verificado; candidato separado para publicacion |
| T11 compilador | Solo evaluacion, no listo para migrar |
| T12 simplificacion | Esta propuesta limitada a limpieza; no incluye migracion |
| T13 Oxlint | No iniciada/adoptada |
| T14 Vitest | No iniciada/adoptada |

T11 conserva pendientes el arranque con PostgreSQL de prueba, limpieza de JS obsoleto y reinicio coordinado multifichero. Se mantiene Nest CLI. La limpieza no resuelve por si sola todas las alertas de minimatch/glob/deepmerge.

## Publicacion y rollback

No se crea commit ni se hace push en la preparacion. Al autorizarlo, comprobar que main no cambio, preparar solo estos archivos y el lock candidato, revisar el diff en staging y publicar el SHA. Preservar fuera de staging los experimentos y trabajo ajeno.

Render lo gestiona el usuario. No requiere nuevas variables ni migraciones. Un rollback consiste en revertir este commit y reinstalar desde el lock anterior; no afecta datos de clientes.

Esta verificacion local no garantiza ausencia absoluta de errores ni prueba consumo real de Render. No se presenta como migracion completa o auditoria global sin alertas.
