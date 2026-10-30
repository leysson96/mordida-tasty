# T3: consultas periodicas sin solapamiento

Fecha: 2026-10-30. Cambios locales; sin commit, push, despliegue o cambio de plan.

## Implementacion

- Helper startPolling: una ronda en vuelo, siguiente ronda tras finalizar la anterior, limite de espera de 15 segundos, backoff por fallos hasta 30 segundos y cancelacion al desmontar.
- Cocina: ronda nominal de pedidos cada 2 segundos tras completar la anterior; carga inicial de configuracion tambien cancelable y limitada.
- Caja: pedidos y dashboard cada 8 segundos tras completar ambos (Promise.allSettled evita iniciar otra ronda si solo uno ha fallado). Ajustes separados cada 30 segundos.
- Ajustes editables: proteccion por seccion y revision de edicion; no se sobrescriben borradores por un sondeo ni por una respuesta de guardado anterior a una nueva edicion. Al guardar correctamente sin ediciones posteriores se libera la proteccion de esa seccion. El estado operativo y configuracion no editada se siguen actualizando.
- Seguimiento: cada 10 segundos tras finalizar la consulta. En un error conserva el ultimo pedido visible, muestra aviso y reintenta.
- Cancelar la pantalla solo cancela su espera de refresh; no aborta el refresh compartido. El refresh tiene timeout propio. Un 500/503 o fallo de red no equivale a credenciales invalidas; solo rechazo 401/403 produce la ruta de sesion expirada existente.
- No se modificaron duraciones de sesiones, contrasenas, precios, pagos ni limites de efectivo. No se agregan reintentos automaticos a escrituras; se mantiene la logica previa de renovacion.

El seguimiento no se detiene automaticamente en DELIVERED: el cobro en efectivo y otros datos del pedido pueden confirmarse despues. Cambiar esa regla requiere distinguir estado logistico y pago; se conserva el comportamiento para no ocultar confirmaciones posteriores.

## Pruebas

e2e/polling-resilience.spec.ts contiene ocho escenarios, ejecutados en escritorio y movil:

1. Cocina espera una respuesta lenta sin nuevas rondas; navegar detiene el sondeo.
2. Error 500: aumenta la espera y recupera la actualizacion.
3. Caja refresca pedidos, reduce recargas de ajustes y conserva un borrador de IVA; indicador de pedido nuevo visible.
4. Consulta atascada: aborta a los 15 segundos y se recupera sin abandonar la sesion.
5. Cambio de filtros: una respuesta anterior no vuelve a insertar pedidos del filtro viejo.
6. Seguimiento: mantiene el pedido visible durante error y elimina el aviso tras recuperarse.
7. Navegacion durante refresh: se comparte la renovacion y funciona al volver.
8. Refresh con 503: permanece en admin y se recupera al restablecerse el servicio.

Se usan rutas API simuladas, reloj controlado y navegador real. Los ensayos iniciales corrigieron CORS de fixtures, conteo de montaje doble en StrictMode y selector de alertas (Next tambien incluye un anunciador accesible). Los cambios no desactivan StrictMode.

## Resultado conjunto

Comando:

```powershell
npm.cmd run test:e2e -- e2e/polling-resilience.spec.ts e2e/image-delivery.spec.ts e2e/promotion-pricing.spec.ts e2e/mordida-smoke.spec.ts
```

- 40 pruebas pasan: 16 de resiliencia, 8 de imagenes, 2 de precios promocionales y 14 smoke de cliente/admin.
- Incluye registro/login, checkout simulado, seguimiento, 2FA, uploads de marca, promocion y carrito.
- npm.cmd run lint: API y web pasan.
- npm.cmd run build -w @mordida/web: pasa.
- API sin cambios funcionales nuevos desde T2: 297 tests y build verificados en T2; no se repitieron innecesariamente.
- git diff --check: sin errores; next-env generado queda como antes tras build.
- Servidores de pruebas gestionados y detenidos por el runner E2E.

## Limites y despliegue pendiente

Se verifica ausencia de solapamiento del sondeo en el cliente; abortar una peticion no garantiza cancelar consultas ya iniciadas por el servidor. No se midio aqui una nueva reduccion de RSS en Render. Las pruebas no realizan ventas, cargos ni escrituras reales de produccion. Tampoco equivalen a una sesion de tablet de varias horas.

Los 404 de favicon sin API local de servidor y de la URL ficticia Cloudinary del smoke siguen siendo limitaciones conocidas del fixture, no se presentan como prueba de disponibilidad real.

T1, T2 y T3 quedan implementadas localmente. Antes de desplegar se requiere aprobacion del usuario; despues, observar RAM/CPU/eventos de ambos servicios en Render y comprobar pedidos/alertas con dispositivos reales. No afirmar que el OOM de produccion esta resuelto sin esa observacion.

Rollback: revertir archivos de T3 (componentes, api.ts y polling.ts) y reconstruir web. Sin migraciones de BD ni cambios de variables necesarios.
