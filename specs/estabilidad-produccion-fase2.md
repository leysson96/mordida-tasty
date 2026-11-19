# Estabilidad de produccion: fase 2

Actualizacion documental: 2026-11-19 10:03:19 +01:00 (Europe/Madrid).
Orden ratificado: cierre npm en commit local -> CRM T7 -> audio T9.
No se ha implementado T7/T9 por esta edicion ni se han probado sus optimizaciones.

## Contexto

- ORDEN VIGENTE 2026-11-18: Seguridad-S5 picomatch -> esta hoja T7 CRM ->
  esta hoja T9 audio. T5/T6/T8 y migraciones de herramientas quedan en espera.
  Esta instruccion sustituye el orden historico al final de la hoja.
  Ver [indice activo](../docs/ESTADO_TRABAJO.md).

- Actualizacion de estado 2026-11-04: el parche de seguridad se subio a main en 267fa01. La consulta de GitHub del 2026-11-02 mostro solo #42 minimatch y #40 deepmerge abiertas. Reportes/CRM pausados por el usuario; plan especifico de continuacion en specs/seguridad-herramientas-desarrollo.md. Las notas posteriores de T4 conservan su contexto historico local.

- Preparacion: 2026-10-30. Base: db21b48, ya subido a main con T1 (CDN), T2 (limpieza del limitador) y T3 (sondeo secuencial).
- El usuario gestiona exclusivamente Render. El agente prepara, prueba y, cuando el usuario lo autoriza, hace commit/push a GitHub. No iniciar sesion, desplegar ni cambiar planes/variables en Render.
- Referencias: docs/AUDITORIA_MEMORIA_2026-10-29.md y docs/VERIFICACION_T1_IMAGENES.md, VERIFICACION_T2_LIMITADOR.md, VERIFICACION_T3_SONDEO.md. Estos informes describen pruebas locales historicas, no monitorizacion de produccion.
- GitHub #26 confirmada por API el 2026-10-30: Multer 2.4.0, GHSA-q7qp-rjg7-q26m. Parche 2.5.0 verificado localmente; pendiente de push autorizado y cierre remoto. Hay otros avisos pendientes: docs/VERIFICACION_T4_SEGURIDAD.md. No asumir auditoria global limpia.
- Codigo existente: Next/React/TypeScript; API Nest/Prisma/PostgreSQL; imagenes Cloudinary. Conservar contratos, modelos de identificacion del CRM y reglas financieras actuales.
- El usuario no dispone de WSL/Docker y no desea reinstalarlos. Las pruebas con BD requieren una instancia PostgreSQL de pruebas aislada, nativa o proporcionada por el usuario; nunca reutilizar la BD de produccion para poblar fixtures o hacer carga.

## Objetivo

Resolver la alerta pendiente, reducir cargas no acotadas de reportes/CRM y robustecer favicon/audio, dejando pruebas reproducibles y mediciones honestas, sin alterar ventas ni aumentar costes automaticamente.

## Flujo

```text
SECUENCIA
1. Identificar alerta real -> corregir dependencia minima -> verificar regresiones.
2. Usuario guarda metricas de Render -> confirma version desplegada por servicio.
3. Agente compara evidencias -> separa web, API, navegador y BD.
4. Agente implementa una tarea local -> pruebas funcionales y de recursos.
5. Agente entrega resultado concreto y limites -> usuario revisa.
6. Con autorizacion, commit/push a GitHub -> usuario despliega en Render.
7. Comparar un turno y 24-48 h -> cerrar solo lo demostrado.

DECISIONES
Alerta accesible? --no--> obtener detalles; auditar lock sin afirmar equivalencia
       | si
Version corregida compatible? --no--> evaluar alternativa minima, documentar impacto
       | si
Aplicar -> pruebas pasan? --no--> corregir antes de publicar
       | si
Resultado local listo -> autorizacion push -> despliegue del usuario

Datos/reportes nuevos == resultados actuales? --no--> no aceptar optimizacion
       | si
Memoria acotada y tiempos medidos? --no--> medir con fixtures aislados
       | si
Documentar limites -> revision de usuario
```

## Restricciones

- Esta solicitud prepara documentacion; no inicia aun la implementacion de T4-T9 ni publica cambios.
- No cambiar precios, IVA, descuentos, devoluciones, caja/efectivo, pedidos o duracion de sesiones como parte de una optimizacion.
- No fusionar ni borrar clientes. Preservar normalizacion de email/telefono y seleccion de codigo postal ya corregidas.
- No secretos, datos personales ni contenidos reales de pedidos en logs/capturas/informes de rendimiento.
- No pruebas de carga en produccion. No desactivar alertas, seguridad o rate limiting para mejorar cifras.
- Sin actualizaciones masivas, npm audit fix --force ni version supuesta como "la ultima". Consultar registro y fuentes oficiales al ejecutar la tarea, fijar la version compatible necesaria y revisar el lockfile.
- Sin Redis, nuevos servicios o dependencias salvo necesidad demostrada. Usar herramientas y APIs existentes.
- Conservar cambios/artefactos ajenos en el worktree, sin incluirlos en los commits de esta fase.
- No presentar mocks como verificacion PostgreSQL ni RSS de Windows como memoria total de un contenedor Linux.

## Fuera de alcance

- Rediseno de carta/admin, marketing, nuevas funciones del CRM y cambios de impresora.
- Cambios de alojamiento, planes de pago, facturacion o topologia de produccion.
- Rehacer T1-T3 o certificar un 100% sin fallos futuros.

## Tareas

### T4: Alerta de seguridad #26 (primera prioridad)

- **Estado:** #26 corregida y probada localmente (300 tests API, lint/build y reproduccion del fallo pasan); sin commit/push. Avisos adicionales pendientes, especialmente body-parser/zod, antes de pasar a optimizaciones no urgentes. https://github.com/leysson96/mordida-tasty/security/dependabot/26
- **Hacer:** obtener aviso completo con acceso autenticado disponible o detalle proporcionado por el usuario; registrar GHSA/CVE, paquete/ruta transitiva, rango vulnerable, version corregida y exposicion real. Complementar con npm audit --json y npm ls del paquete. Si no hay acceso a #26, no inventar sus detalles ni cerrarla como resuelta.
- **Solucion:** actualizar el paquete directo o su dependencia padre al parche compatible; override solo si necesario y justificado. Revisar Node requerido, dependencias pares y diferencias del lock; conservar configuracion de binarios Sharp Linux.
- **Herramientas:** GitHub/Dependabot, npm, boletin oficial, Jest, Playwright y compiladores actuales del repo. No necesita libreria nueva de auditoria.
- **Archivos:** package.json/app package.json/package-lock.json segun afectado; prueba de regresion dirigida si el fallo es reproducible; docs/VERIFICACION_T4_SEGURIDAD.md.
- **Verify:** reproduccion o prueba pertinente del fallo; audit/inspeccion de arbol sin version vulnerable en la ruta relevante; lint y build del servicio afectado; tests apropiados al alcance. El informe debe distinguir la correccion local del cierre de alerta confirmado por GitHub tras un push autorizado.
- **Reversibilidad:** conservar SHA previo. Un rollback que reintroduce vulnerabilidad requiere reconocer ese coste, no presentarlo como solucion final.

### T5: Comparacion de consumo T1-T3 (en paralelo, sin codigo)

- **Estado:** pendiente de evidencias de Render. No bloquea el trabajo local de las otras tareas.
- **Responsable Render:** usuario; agente analiza datos facilitados, sin gestionar el panel.
- **Recoger:** SHA y hora de despliegue de web/API por separado; tipo de instancia y limite; Memory/RSS, CPU, requests si disponibles, reinicios/OOM y logs cercanos. Antes y despues, misma zona Europe/Madrid y rangos comparables. Si no hay grafica previa, no inventar baseline.
- **Comparar:** un turno de servicio y 24-48 h, incluyendo reposo, inicio con cache fria, carga normal y visitas/carga disponible. Separar picos transitorios de crecimiento monotono; no confundir CPU/RAM del navegador con Render.
- **Herramientas:** graficas/exportaciones Render que aporte el usuario y scripts/audit-*. No crear una ruta publica que exponga metricas internas o secretos.
- **Artefacto:** docs/SEGUIMIENTO_CONSUMO_RENDER.md, con plantilla preparada y valores pendientes explicitos.
- **Verify:** version correcta en ambos servicios y tendencia/picos registrados; ausencia o recurrencia de OOM documentada. No prometer que 512 MB bastaran indefinidamente.

### T6: Reportes con procesamiento acotado

- **Estado:** pendiente.
- **Hacer:** inventariar salida de salesReport y dashboardToday: ingresos cobrados, efectivo pendiente, cancelaciones/reembolsos, items retirados, descuentos, productos y agrupacion por dia. Capturar resultados actuales con fixtures de referencia antes de cambiar consultas.
- **Solucion:** usar agregaciones Prisma/PostgreSQL para sumas/conteos compatibles; para reglas que requieran detalle, procesar lotes con cursor estable y acumuladores acotados. SQL solo parametrizado si Prisma no expresa fielmente la operacion. No guardar todos los lotes ni todos los pedidos para agregarlos al final.
- **Fechas:** preservar Europe/Madrid, rango inclusivo/exclusivo y cambio de horario. La salida diaria crece con el rango: medir y proponer limite explicito o exportacion si hace falta; no rechazar silenciosamente rangos antes validos ni truncar datos sin una decision revisable.
- **Archivos:** apps/api/src/orders/orders.service.ts, tests de reportes, DTO si se acuerda limite, e2e/report-performance.spec.ts si cambia contrato UI, docs/VERIFICACION_T6_REPORTES.md.
- **Herramientas:** Prisma aggregate/groupBy, TypeScript para reglas existentes, Jest, PostgreSQL de prueba; EXPLAIN ANALYZE solo en pruebas y con datos sinteticos.
- **Verify:** igualdad exacta de todos los campos monetarios en centimos y conteos para fixtures pequenos; casos vacio, fallido, cancelado, reembolso parcial/total, efectivo pendiente/cobrado, items retirados y cambios de fecha. Fixtures de 1000 y 10000 pedidos en BD aislada para RSS/p95/consultas; pagina de reportes y filtros siguen funcionando.
- **Criterio:** no traer todos los pedidos del rango en una sola respuesta de BD; resultados identicos a referencia. Sin PostgreSQL de pruebas, marcar rendimiento SQL pendiente, no "validado".

### T7: Paginacion de invitados del CRM

- **Inicio autorizado en el orden:** despues de cerrar S5. Alcance: optimizar
  CRM existente, no crear otro CRM, segmentaciones ni campanas comerciales.
- **Tecnologia:** TypeScript/Nest y Prisma ya instalados; PostgreSQL para
  agregacion/paginacion, libphonenumber-js actual para identidad. No cambiar
  librerias salvo necesidad demostrada y compatibilidad verificada.
- **Pasos:** capturar resultados de referencia -> disenar consulta equivalente
  -> implementar una pieza -> comparar resultados/recursos -> revisar UI.
- **BD de prueba:** verificar primero instancia aislada y autorizada. Si no
  existe, preparar fixtures y solicitar el dato necesario sin pedir secretos
  en chat; no instalar servicios, WSL/Docker ni usar datos reales por defecto.
  Sin BD aislada no cerrar validacion SQL ni prometer rendimiento probado.

- **Estado:** pendiente; separada de reportes para no mezclar reglas.
- **Hacer:** conservar la identidad normalizada y el ultimo nombre/codigo postal relevante. Actualmente se agrupa en BD pero se ordenan todos los grupos en JS antes de slice.
- **Solucion:** trasladar agregacion, orden estable y paginacion a PostgreSQL manteniendo exactamente las reglas del servicio. Evitar normalizacion SQL simplificada que deje de equivaler a libphonenumber-js. Si exige columnas normalizadas/migracion, documentar primero backfill idempotente, compatibilidad y rollback; no ejecutar migraciones de produccion durante esta tarea.
- **Archivos:** apps/api/src/admin-customers/admin-customers.service.ts y specs; schema/migracion solo si se demuestra necesaria; e2e/admin-customers.spec.ts/fixtures; docs/VERIFICACION_T7_CRM.md.
- **Herramientas:** Prisma y SQL parametrizado cuando corresponda, PostgreSQL aislado, Jest, Playwright.
- **Verify:** total y paginas correctos, orden estable con empates, busqueda por nombre/email/telefono/postal, sin duplicar/omitir registros entre paginas, datos enmascarados y permisos intactos. Casos de email con mayusculas, formatos telefonicos equivalentes, nombres iguales con distinta identidad, direcciones cambiantes, invitados sin contacto completo y clientes registrados.
- **Volumen:** 1000/10000 identidades sinteticas, medir consultas, RAM y tiempos; no usar datos reales de clientes.
- **Criterio:** no materializar todos los invitados por cada pagina; mismos identificadores y totales que referencia.

### T8: Favicon con descarga y cache controladas

- **Estado:** pendiente.
- **Hacer:** revisar apps/web/app/brand-icon.png/route.ts y endurecer sus dos fetch sin cambiar la URL publica ni como se sube el logo desde admin.
- **Propuesta tecnica para implementar y probar:** deadline total de 10 segundos, lectura por streaming con maximo 5 MiB comprobado durante descarga, validacion PNG existente, cancelacion/liberacion del reader en errores. Validar destino tambien en redirecciones; no permitir fetch arbitrario.
- **Cache:** solo recurso publico, una entrada acotada y una promesa en vuelo compartida; revalidacion de settings cada 60 segundos. Distinguir eliminacion explicita del logo de fallo transitorio. No servir logo retirado intencionadamente; fallback stale solo para fallo temporal y con limite explicito de cinco minutos. Si el plazo acumulado con Cache-Control del navegador excede esos limites, ajustar cabeceras y documentar el tiempo efectivo de actualizacion.
- **Limites:** una instancia no comparte cache con otras; no introducir Redis. El aborto de un cliente no debe destruir una descarga compartida por otros; usar deadline interno propio.
- **Archivos:** route.ts y helper pequeno si conviene; prueba de route handler/servidor con upstream local simulado; docs/VERIFICACION_T8_FAVICON.md.
- **Herramientas:** fetch, AbortController, ReadableStream, NextResponse; sin nuevas dependencias de imagen.
- **Verify:** PNG correcto y transparencia, respuesta lenta, upstream 500, Content-Length ausente/falso, >5 MiB por chunks, firma invalida, redireccion no admitida, cambio/retirada de logo, varias peticiones concurrentes y liberacion tras fallo. Confirmar href de favicon y estabilidad de URL; no prometer fecha de actualizacion en Google.

### T9: Ciclo de vida del audio de cocina

- **Inicio autorizado en el orden:** despues de T7; si T7 queda bloqueada,
  informar y solicitar cambio de orden, no saltarla automaticamente.
- **Tecnologia:** React/TypeScript existentes, Web Audio API nativa,
  AbortController o bandera de ciclo de vida segun patron actual; Playwright
  instrumenta AudioContext/nodos/timers. No instalar libreria de audio.
- **Pasos:** medir ciclo actual -> corregir cleanup y carreras de resume ->
  probar montaje/desmontaje/cambios -> revision audible del usuario.

- **Estado:** pendiente.
- **Hacer:** revisar KitchenAlarm y sus instancias; cerrar AudioContext al desmontar, detener y desconectar oscillator/gain al terminar, limpiar timers y evitar crear nodos despues del desmontaje si resume() seguia pendiente.
- **Semantica:** silenciar no rompe la siguiente alerta; no cerrar el contexto que utiliza otra instancia; mantener permisos/gesto del usuario y preferencia persistida. No pausar alertas de cocina solo por ocultar la pestaña.
- **Archivos:** apps/web/components/kitchen-alarm.tsx, e2e/kitchen-audio.spec.ts, docs/VERIFICACION_T9_AUDIO.md.
- **Herramientas:** Web Audio API, React useEffect/useRef, Playwright con instrumentacion para contar contextos/nodos; ninguna libreria nueva de sonido.
- **Verify:** montaje/desmontaje y navegacion repetida, StrictMode, probar sonido, silencio, pedido nuevo, audio suspendido/bloqueado y resume lento. Contadores de recursos vuelven al nivel base al salir; sin excepciones tardias. Prueba audible final por usuario en ordenador y tablet: un navegador automatizado no certifica altavoces/permisos reales.

## Orden de trabajo

Orden vigente: S5 -> T7 -> T9. La lista siguiente es historica (octubre),
no autoriza intercalar reportes, favicon o mediciones nuevas de Render.

1. T4 seguridad.
2. T5 recoger evidencias en paralelo, sin detener trabajo local por falta de metricas.
3. T6 reportes y T7 CRM, uno a uno con comparacion de resultados.
4. T8 favicon.
5. T9 audio.

Si T7 necesita PostgreSQL de prueba que no este disponible, dejar el bloqueo
explicito y consultar antes de cambiar el orden vigente; nunca sustituir una
prueba SQL por un mock y darla por completada.

## Done (validacion por tarea y final)

- [ ] Hallazgo confirmado, cambio minimo y prueba ligada a ese fallo.
- [ ] Informe por tarea con comando, resultado real, limites y rollback.
- [ ] npm.cmd run lint.
- [ ] npm.cmd run test -w @mordida/api -- --runInBand cuando haya cambios API/dependencias.
- [ ] npm.cmd run build -w @mordida/api y/o npm.cmd run build -w @mordida/web segun alcance.
- [ ] E2E dirigidos desktop/mobile y regresiones compartidas pertinentes.
- [ ] Mediciones repetidas con datos/carga comparables; no cambiar varios factores y atribuir todo el ahorro a uno.
- [ ] git diff --check y revision del staging sin archivos ajenos, secretos o artefactos grandes.
- [ ] Usuario autoriza commit/push; el agente sube a GitHub y el usuario despliega en Render.
- [ ] Estado de alerta confirmado tras push, cuando haya acceso; metricas posteriores documentadas con limites de inferencia.

Preparacion original terminada. Actualizacion 2026-10-31: T4 y parches compatibles adicionales verificados localmente; runtime sin avisos de npm audit. Persiste deepmerge en desarrollo sin parche oficial. Sin commit/push de esta fase; T5-T9 pendientes. Ver docs/SEGURIDAD_DEPENDENCIAS_2026-10-31.md.
