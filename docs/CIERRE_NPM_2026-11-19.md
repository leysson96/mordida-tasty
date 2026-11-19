# Cierre local de coherencia npm

Documentado: 2026-11-19 10:03:19 +01:00 (Europe/Madrid).
Ultima actualizacion: 2026-11-19 10:03:19 +01:00 (Europe/Madrid).
Revision iniciada: 2026-11-19 10:02:31 +01:00 (Europe/Madrid).
Comprobaciones consultadas hasta: 2026-11-19 10:03:19 +01:00 (Europe/Madrid).
Base: fix/search-brand-identity, 0d34e9f, con ajuste local de dependencias.
Estado: cierre para commit local; sin autorizacion de push en esta entrega.

## Alcance

Corregir los rangos de glob 14.0.5: minimatch 11.0.9 y path-scurry 3.0.0,
con sus dependencias compatibles. Preservar rama legacy de minimatch y los
metadatos de Sharp Linux. Anadir npm ls completo a test:toolchain para que
un arbol invalido detenga la verificacion. No se modifica picomatch ni logica
de negocio. No hay migraciones de BD ni variables nuevas.

Se incluyen indice, norma de documentacion, informes S3/S5 y orden vigente
seguridad -> CRM T7 -> audio T9. Capturas y experimentos anteriores se dejan
fuera, sin eliminarlos. T11-T14 de herramientas permanecen pausadas.

## Evidencia de hoy

- npm run test:toolchain: exit 0, incluido npm ls --all sin problemas, pruebas
  de minimatch/deepmerge, cancelacion glob, assets y watcher Nest.
- npm run lint: API/web exit 0.
- Auditoria de registro entre 10:02:58 y 10:03:03 +01:00 (Europe/Madrid):
  npm audit --json y --omit=dev --json, ambos exit 0, total 0.
- git diff --check sin errores antes de preparar el commit.

## Evidencia anterior que no se reejecuta hoy

El 2026-11-18 (horas no registradas en el informe original): 303 tests API,
40 E2E, builds API/web, instalacion limpia de 872 paquetes y arbol completo
valido. Se conservan esos resultados sin atribuirles una nueva hora.
Ver [S3](./VERIFICACION_S3_GLOB.md). No hubo cambios funcionales posteriores
en los archivos de ese ajuste, salvo documentacion.

## Estado al pasar a CRM

Seguridad y coherencia npm cerradas localmente para el alcance revisado.
Picomatch no requiere parche para el aviso retirado; no se certifica el estado
privado de Dependabot ni ausencia absoluta de vulnerabilidades futuras.
Render sigue operativo segun el usuario; no se investiga una caida actual.

Este cierre queda en un commit local, pendiente de subida autorizada. El SHA
y la hora real del commit se obtienen de git log; no se inventan previamente.
No se declara desplegado. Siguiente implementacion: Estabilidad-T7 CRM.
Publicacion y despliegue son estados distintos y no bloquean estudiar CRM
localmente una vez aislado este cambio en su propio commit.
