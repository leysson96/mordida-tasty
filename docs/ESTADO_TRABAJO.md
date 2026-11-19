# Estado de trabajo

Ultima edicion documental: 2026-11-19 10:03:19 +01:00 (Europe/Madrid).
Motivo: cierre local previo a CRM. Verificacion npm de hoy registrada por separado.
Norma obligatoria: [documentacion y trazabilidad](./NORMA_DOCUMENTACION.md).

Actualizado: 2026-11-19. Este indice prevalece para el estado y el orden de
trabajo; los informes fechados conservan la evidencia historica, no son una
autorizacion para publicar ni una garantia de estado actual de Render.

## Estado operativo y auditoria actual

El usuario confirma el 18 que Render esta activo y funcional y que no ha
vuelto a caer desde el ultimo incidente. No existe una caida actual demostrada.
No confundir correcciones locales de dependencias con una incidencia de
produccion. Revision de Git, codigo pendiente y trazabilidad:
[auditoria de estado](./AUDITORIA_ESTADO_2026-11-18.md).

## Entrega de seguridad publicada

Commit 0d34e9f confirmado en main de GitHub. El usuario comunica despliegue
activo en Render; no se presenta como verificacion independiente del servidor.

- S1: minimatch moderno 11.0.4; API antigua preservada.
- S2: deepmerge sustituido por @stackline/deepmerge 1.1.2, con pruebas de
  contrato y contaminacion de prototipos. Es otro mantenedor, no un release
  oficial del paquete original; decision documentada en el informe S2.
- S3: glob 14.0.5 para el CLI; Jest conserva glob 7.2.3. Misma version de Nest.
- S4: Next/env/plugin 16.4.6; plugin declarado en la raiz donde ESLint lo usa.
- Comando reproducible: `npm run test:toolchain`.
- Primera auditoria del 18: runtime 0 y completa 50 nodos high por picomatch.
  Ultima consulta: ambas 0, tras retirada oficial del aviso; ver estado S5 abajo.
- No hay migraciones de BD, variables nuevas ni cambios en pedidos, precios,
  sesiones, UI o configuracion de impresoras.

Evidencia de instalacion limpia, lint, 303 tests API, 40 E2E y builds:
[informe del 17](./SEGURIDAD_HERRAMIENTAS_2026-11-17.md),
[S1](./VERIFICACION_S1_MINIMATCH.md), [S2](./VERIFICACION_S2_DEEPMERGE.md),
[S3](./VERIFICACION_S3_GLOB.md).
Las pruebas E2E usan API/pagos simulados; no prueban ventas reales ni memoria
del contenedor Render. Los scripts propios se ejecutan sobre archivos temporales.

## Orden activo aprobado el 2026-11-18

Cierre local 2026-11-19: ajuste npm y documentacion preparados para commit
local por instruccion del usuario, sin push. [Evidencia de cierre](./CIERRE_NPM_2026-11-19.md).
Tras crear ese commit, siguiente tarea: CRM T7; despues audio T9. Las notas
del 18 siguientes conservan la procedencia del ajuste, no ordenan reabrirlo.

Resultado posterior del 18: npm audit completo y runtime terminan con 0
avisos (exit 0), sin cambiar picomatch. El aviso oficial esta retirado;
se despeja la discrepancia local, pero no se afirma cierre remoto de Dependabot.
Se detecto y corrigio localmente un arbol incoherente de glob; esta correccion
aun no esta publicada. Ver [S3](./VERIFICACION_S3_GLOB.md) y
[S5](./VERIFICACION_S5_PICOMATCH.md). La discrepancia anterior permanece como
evidencia historica en el informe, no como estado vigente del indice.

Esta instruccion sustituye la propuesta anterior de retomar Herramientas-T11:

1. Seguridad-S5: resolver picomatch y probar la solucion.
2. Estabilidad-T7: optimizar paginacion del CRM existente, sin nuevas funciones.
3. Estabilidad-T9: liberar recursos del audio de cocina, sin cambiar avisos.

Se conservan los identificadores existentes para no crear otra numeracion T.
Herramientas-T11/T12/T13/T14 quedan pausadas. Reportes T6, favicon T8 y consumo
Render T5 no se intercalan como tareas nuevas de esta entrega.

```text
Secuencia: S5 diagnostico -> correccion compatible -> pruebas -> cierre local
           -> T7 CRM -> pruebas de identidad/SQL -> T9 audio -> pruebas de recursos

Decision: solucion segura de S5 disponible?
          si -> verificar -> pasa? si: continuar / no: corregir
          no -> documentar bloqueo y alternativas -> consultar al usuario
                (no saltar automaticamente a CRM ni llamar resuelta una mitigacion)
```

Herramientas y criterios detallados: [Seguridad-S5](../specs/seguridad-herramientas-desarrollo.md)
y [Estabilidad-T7/T9](../specs/estabilidad-produccion-fase2.md).
Trabajo local; cada resultado se informa antes de la siguiente pieza.
La autorizacion de subida de 0d34e9f no autoriza nuevos commits/push.

## Herramientas: estado conservado, trabajo pausado

Referencia: [evaluacion T10-T14](../specs/evaluacion-herramientas-proyecto.md).

| Identificador | Estado |
| --- | --- |
| Herramientas-T10 | Limpieza eslint-config-next publicada en e4a6a10 |
| Herramientas-T11 | Parcial: comparacion de compilacion; faltan arranque con BD aislada y ciclo completo de desarrollo |
| Herramientas-T12 | Propuesta parcial; conservar herramientas actuales hasta demostrar una sustitucion segura |
| Herramientas-T13 | Comparacion ESLint/Oxlint pendiente |
| Herramientas-T14 | Comparacion Jest/Vitest pendiente |
| Seguridad-S1-S4 | Publicadas en 0d34e9f; despliegue comunicado por el usuario |
| Seguridad-S5 | Aviso retirado; audit completo/runtime 0. Sin parche picomatch. Estado privado de Dependabot no comprobado |

No llamar a una tarea simplemente T11/T14 sin indicar su hoja: el antiguo plan
CRM reutiliza esa numeracion. Los scripts de experimentacion del compilador y
sus artefactos no se incluyen en esta entrega ni sustituyen build/dev/start.

## Otras tareas en espera

[Estabilidad fase 2](../specs/estabilidad-produccion-fase2.md): T5 metricas
Render, T6 reportes y T8 favicon quedan en espera. T7 CRM y T9 audio se retoman
despues de S5 por instruccion expresa del usuario. T1-T3 de estabilidad
fueron publicados en db21b48; el ahorro real requiere evidencias de Render.

## Publicacion y siguiente paso

La entrega 0d34e9f ya esta en main y el usuario confirma su despliegue. No hay
que repetir ese despliegue por esta auditoria. El ajuste posterior de rangos
de glob y el nuevo control npm son locales; la autorizacion anterior no se
extiende automaticamente a otra publicacion. Render lo gestiona el usuario.
La entrega local se cierra en el commit que incluye el informe del 19; queda
pendiente su subida autorizada. Continuar en local con CRM T7 -> audio T9.
No retomar migraciones de herramientas ni investigaciones de caidas sin una
nueva instruccion o evidencia.
