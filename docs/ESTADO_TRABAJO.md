# Estado de trabajo

Actualizado: 2026-11-18. Este indice prevalece para el estado y el orden de
trabajo; los informes fechados conservan la evidencia historica, no son una
autorizacion para publicar ni una garantia de estado actual de Render.

## Entrega de seguridad preparada

- S1: minimatch moderno 11.0.4; API antigua preservada.
- S2: deepmerge sustituido por @stackline/deepmerge 1.1.2, con pruebas de
  contrato y contaminacion de prototipos. Es otro mantenedor, no un release
  oficial del paquete original; decision documentada en el informe S2.
- S3: glob 14.0.5 para el CLI; Jest conserva glob 7.2.3. Misma version de Nest.
- S4: Next/env/plugin 16.4.6; plugin declarado en la raiz donde ESLint lo usa.
- Comando reproducible: `npm run test:toolchain`.
- Auditoria npm repetida el 18: runtime 0; completa 50 nodos high derivados
  de picomatch GHSA-fc5q-39xc-vjpf. S5 NO esta corregida ni descartada.
- No hay migraciones de BD, variables nuevas ni cambios en pedidos, precios,
  sesiones, UI o configuracion de impresoras.

Evidencia de instalacion limpia, lint, 303 tests API, 40 E2E y builds:
[informe del 17](./SEGURIDAD_HERRAMIENTAS_2026-11-17.md),
[S1](./VERIFICACION_S1_MINIMATCH.md), [S2](./VERIFICACION_S2_DEEPMERGE.md),
[S3](./VERIFICACION_S3_GLOB.md).
Las pruebas E2E usan API/pagos simulados; no prueban ventas reales ni memoria
del contenedor Render. Los scripts propios se ejecutan sobre archivos temporales.

## Hoja activa: herramientas

Referencia: [evaluacion T10-T14](../specs/evaluacion-herramientas-proyecto.md).

| Identificador | Estado |
| --- | --- |
| Herramientas-T10 | Limpieza eslint-config-next publicada en e4a6a10 |
| Herramientas-T11 | Parcial: comparacion de compilacion; faltan arranque con BD aislada y ciclo completo de desarrollo |
| Herramientas-T12 | Propuesta parcial; conservar herramientas actuales hasta demostrar una sustitucion segura |
| Herramientas-T13 | Comparacion ESLint/Oxlint pendiente |
| Herramientas-T14 | Comparacion Jest/Vitest pendiente |
| Seguridad-S1-S4 | Parche local probado, incluido en esta entrega |
| Seguridad-S5 | Picomatch abierto; no existe parche oficial en la ultima consulta documentada |

No llamar a una tarea simplemente T11/T14 sin indicar su hoja: el antiguo plan
CRM reutiliza esa numeracion. Los scripts de experimentacion del compilador y
sus artefactos no se incluyen en esta entrega ni sustituyen build/dev/start.

## Plan anterior pausado

[Estabilidad fase 2](../specs/estabilidad-produccion-fase2.md): T5 metricas
Render, T6 reportes, T7 paginacion CRM, T8 favicon y T9 audio. No son la
continuacion automatica del trabajo de herramientas. T1-T3 de estabilidad
fueron publicados en db21b48; el ahorro real requiere evidencias de Render.

## Publicacion y siguiente paso

El usuario autoriza commit y subida a GitHub el 18; el usuario gestiona Render.
Verificar el SHA remoto despues del push. No declarar desplegado el servicio
por el mero exito de git push ni afirmar cerradas alertas sin reevaluacion.
En Render: desplegar el nuevo SHA en web/API con los comandos existentes,
comprobar arranque, carta, acceso admin y flujo habitual. No hacen falta nuevas
variables ni operaciones de BD para esta entrega.
Tras comprobar la entrega, retomar Herramientas-T11; no saltar a CRM/audio ni
mezclar S5 con una migracion no probada.
