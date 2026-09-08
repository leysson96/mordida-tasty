# Endurecimiento de produccion

## Contexto
- El proyecto es un monorepo con `apps/api` en NestJS/Prisma y `apps/web` en Next.js.
- La auditoria base esta en `docs/AUDITORIA_PRODUCCION_2026-09-07.md`.
- La aplicacion esta en produccion, asi que cada cambio debe ser pequeno,
  verificable y desplegable de forma independiente.
- `OrdersService.createOrder` ya valida tienda abierta antes de crear pedidos.
- `PaymentsService.createCheckoutSession` crea la sesion de Stripe a partir de
  un pedido existente y hoy debe reforzarse para no saltarse reglas de tienda.
- El webhook de Stripe ya valida firma con `stripe.webhooks.constructEvent` y
  no debe bloquearse por estado de tienda cerrada.
- Patrones a seguir: `SettingsService.getServiceStatus`,
  `OrdersService.transitionOrder`, DTOs con `class-validator`, tests Jest en
  `apps/api/src/**/*.spec.ts`, throttling con `@nestjs/throttler`.
- Decision aprobada: usar ventana de gracia configurable. Por defecto sera de
  15 minutos mediante `CHECKOUT_GRACE_MINUTES`.
- Decision aprobada: si un pedido no puede iniciar checkout porque expiro la
  ventana, debe pasar a `EXPIRED` cuando sea seguro hacerlo, no quedar vivo como
  pendiente indefinido.

## Objetivo
Cerrar los hallazgos P1/P2 de produccion sin romper pedidos, pagos, admin,
cocina, tracking ni la web publica.

## Flujo

```text
SECUENCIA (orden temporal abajo)
1. Cliente -> Web: crea pedido mientras la tienda esta abierta.
2. Web -> API Orders: POST /orders con productos, entrega, pago e
   Idempotency-Key.
3. API Orders -> Settings: valida que la tienda acepta pedidos ahora.
4. API Orders -> DB: crea pedido con trackingToken y estado CREATED.
5. Web -> API Payments: POST /payments/checkout con orderId y trackingToken.
6. API Payments -> API Orders/DB: carga pedido y verifica que el token coincide.
7. API Payments -> Settings: revisa si la tienda sigue abierta.
8. API Payments -> Config: lee CHECKOUT_GRACE_MINUTES.
9. API Payments -> Stripe: crea sesion solo si el pedido es valido, la tienda
   esta abierta o el pedido esta dentro de la ventana de gracia.
10. API Payments -> DB: si la tienda esta cerrada y la ventana expiro, marca el
    pedido como EXPIRED cuando no tenga sesion Stripe activa.
11. Stripe -> Cliente: muestra pago si la sesion fue creada.
12. Stripe -> API Payments webhook: confirma pago firmado aunque la tienda ya
    este cerrada.
13. API Payments -> DB: procesa el webhook firmado y conserva tracking/ticket.
14. Desarrollador -> GitHub/Render: cada tarea se despliega en commit pequeno,
    con lint, tests, build y smoke test del flujo afectado.
```

```text
FLUJO (decisiones y casos borde)
Cliente intenta iniciar pago Stripe
    |
    v
Existe el pedido?
    | no
    v
Rechazar checkout

    | si
    v
El trackingToken coincide con el pedido?
    | no
    v
Rechazar checkout

    | si
    v
El pedido ya esta pagado, cancelado, expirado o sin productos activos?
    | si
    v
Rechazar checkout

    | no
    v
El pedido es CASH?
    | si
    v
Rechazar Stripe: ese pedido no necesita pasarela

    | no
    v
La tienda esta abierta ahora?
    | si
    v
Permitir crear sesion Stripe

    | no
    v
Han pasado mas minutos que CHECKOUT_GRACE_MINUTES desde order.createdAt?
    | no
    v
Permitir pago por ventana de gracia

    | si
    v
El pedido no tiene stripeSessionId activo?
    | si
    v
Marcar pedido EXPIRED y rechazar checkout con mensaje claro

    | no
    v
Rechazar nuevo checkout sin tocar webhook
    |
    v
Stripe envia webhook firmado
    |
    v
El webhook es valido?
    | no
    v
Rechazar webhook

    | si
    v
Procesar webhook aunque la tienda este cerrada
    |
    v
Commit de tarea listo?
    | si
    v
Lint, tests, build, diff, push y smoke test

    | no
    v
No desplegar
```

## Restricciones
- No bloquear `PaymentsService.handleWebhook` por tienda cerrada.
- No confiar en validaciones solo de frontend para pagos, pedidos o importes.
- No ejecutar `npm audit fix` automatico ni actualizar dependencias a ciegas.
- No tocar datos de produccion sin backup previo cuando se trabaje caja/pagos.
- No cambiar el modelo de datos salvo que una tarea lo justifique y tenga
  migracion Prisma con `prisma:deploy`.
- No agregar dependencias nuevas salvo Playwright en la fase de E2E.
- No mezclar cambios: cada tarea debe poder revisarse y revertirse por separado.
- Mantener `npm.cmd` en Windows para lint, test y build.

## Fuera de alcance
- Redisenar checkout, tracking, admin o reportes.
- Cambiar proveedor de pagos.
- Crear facturacion fiscal completa.
- Crear CRM o marketing automation.
- Resolver alertas transitivas de `qs` con cambios no compatibles.
- Legalizar textos RGPD/LSSI; eso queda como revision de negocio/legal externa.

## Tareas
### T0: Configurar ventana de checkout
- **Hacer:** agregar `CHECKOUT_GRACE_MINUTES` al validador de entorno con
  default `15`, rango seguro y tests de config. Documentar que esta variable
  controla cuantos minutos tiene un pedido ya creado para iniciar Stripe si la
  tienda cierra.
- **Archivos:** `apps/api/src/config/env.ts`,
  `apps/api/src/config/env.spec.ts`, `.env.example`.
- **Verify:** `npm.cmd run test -w @mordida/api -- env.spec.ts` y
  `npm.cmd run lint -w @mordida/api`.

### T1: Bloquear Stripe cerrado con gracia y expiracion
- **Hacer:** en `PaymentsService.createCheckoutSession`, consultar
  `SettingsService.getServiceStatus`. Si la tienda esta cerrada, permitir solo
  pedidos dentro de `CHECKOUT_GRACE_MINUTES`. Si el pedido esta fuera de ventana
  y no tiene `stripeSessionId`, transicionarlo a `EXPIRED` y rechazar sin llamar
  a Stripe. Confirmar con test que `handleWebhook` sigue procesando pagos
  firmados aunque la tienda este cerrada.
- **Archivos:** `apps/api/src/payments/payments.service.ts`,
  `apps/api/src/payments/payments.service.spec.ts`,
  `apps/api/src/payments/payments.module.ts`.
- **Verify:** `npm.cmd run test -w @mordida/api -- payments.service.spec.ts`,
  `npm.cmd run lint -w @mordida/api` y `npm.cmd run build -w @mordida/api`.

### T2: Atar checkout a trackingToken
- **Hacer:** exigir `trackingToken` en `CreateCheckoutSessionDto`, enviarlo desde
  checkout web y validar en backend que coincide con el pedido antes de crear
  Stripe. Un pedido con token incorrecto o ausente debe fallar.
- **Archivos:** `apps/api/src/payments/dto/create-checkout-session.dto.ts`,
  `apps/api/src/payments/payments.service.ts`,
  `apps/web/app/checkout/page.tsx`.
- **Verify:** `npm.cmd run test -w @mordida/api -- payments.service.spec.ts`,
  `npm.cmd run lint -w @mordida/api`, `npm.cmd run lint -w @mordida/web`,
  `npm.cmd run build -w @mordida/api` y `npm.cmd run build -w @mordida/web`.

### T3: Unificar politica de contrasena
- **Hacer:** aplicar la misma politica de contrasena en registro, reset y staff:
  minimo 10, maximo 120, mayuscula, minuscula y numero. Evitar duplicacion con
  un helper/decorator local si encaja limpio.
- **Archivos:** `apps/api/src/auth/dto/register.dto.ts`,
  `apps/api/src/auth/dto/password-reset.dto.ts`,
  `apps/api/src/admin/dto/staff.dto.ts`.
- **Verify:** `npm.cmd run test -w @mordida/api -- auth.service.spec.ts` y
  `npm.cmd run lint -w @mordida/api`.

### T4: Throttle especifico en creacion de pedidos
- **Hacer:** anadir `@Throttle` a `POST /orders` para limitar creacion publica
  de pedidos sin afectar `GET /orders/mine` ni tracking. Mantener el limite
  suficientemente usable para clientes reales.
- **Archivos:** `apps/api/src/orders/orders.controller.ts`,
  `apps/api/src/orders/orders.service.spec.ts`.
- **Verify:** `npm.cmd run test -w @mordida/api -- orders.service.spec.ts`,
  `npm.cmd run lint -w @mordida/api` y prueba manual local con varias
  peticiones seguidas.

### T5: Endurecer OriginGuard
- **Hacer:** rechazar mutaciones sin `Origin` o `Referer` valido en rutas de
  navegador, manteniendo excepcion explicita para webhooks server-to-server como
  Stripe. Probar login, registro, crear pedido, admin y webhook.
- **Archivos:** `apps/api/src/common/guards/origin.guard.ts`,
  `apps/api/src/payments/payments.controller.ts`,
  `apps/api/src/common/guards/origin.guard.spec.ts`.
- **Verify:** `npm.cmd run test -w @mordida/api -- origin.guard.spec.ts`,
  `npm.cmd run test -w @mordida/api -- admin-authorization.e2e.spec.ts` y
  `npm.cmd run build -w @mordida/api`.

### T6: Cerrar estado de pagos en efectivo
- **Hacer:** definir flujo operativo de caja. Propuesta: el pedido CASH nace
  confirmado, pero el pago queda pendiente hasta que admin/cocina pulse
  "Efectivo cobrado"; entonces `Payment.status` pasa a `SUCCEEDED`. Antes de
  tocar produccion, sacar backup/copia de la tabla `Payment`.
- **Archivos:** `apps/api/src/payments/payments.service.ts`,
  `apps/api/src/admin/admin.controller.ts`,
  `apps/web/components/admin-orders-client.tsx`.
- **Verify:** `npm.cmd run test -w @mordida/api`, `npm.cmd run lint`,
  `npm.cmd run build` y prueba manual: pedido efectivo delivery con cambio,
  marcar cobrado y revisar reportes/ticket.

### T7: Pruebas E2E con navegador
- **Hacer:** instalar Playwright como dev dependency y crear pruebas de menu,
  checkout efectivo, checkout tarjeta mock/test, tracking, admin, cocina,
  reportes e impresion basica. Cubrir desktop y mobile.
- **Archivos:** `package.json`, `apps/web/package.json`, `e2e/*`.
- **Verify:** `npm.cmd run test:e2e` y capturas en mobile/desktop sin
  solapes ni pantallas rotas.

### T8: Documentacion y runbook de produccion
- **Hacer:** actualizar documentacion con variables nuevas, smoke tests por
  tarea, pasos en Render, pruebas de Stripe, GTM/Maps, backup de pagos y
  estrategia de rollback por commit.
- **Archivos:** `docs/VARIABLES_PRODUCCION.md`,
  `docs/MANUAL_RENDER_PASO_A_PASO.md`, `deploy/render.yaml.example`.
- **Verify:** revision manual: un operador debe poder saber donde cambiar cada
  variable y que probar despues de desplegar.

## Done (validacion final)
- [ ] `npm.cmd run lint` pasa.
- [ ] `npm.cmd run test` pasa.
- [ ] `npm.cmd run build` pasa.
- [ ] `npm.cmd audit --workspaces --omit=dev` queda revisado y documentado,
  aunque existan vulnerabilidades transitivas sin parche.
- [ ] Manual: tienda cerrada no permite crear pedidos nuevos.
- [ ] Manual: pedido creado hace menos de `CHECKOUT_GRACE_MINUTES` puede iniciar
  Stripe aunque la tienda acabe de cerrar.
- [ ] Manual: pedido fuera de ventana no inicia Stripe, no llama a Stripe y queda
  `EXPIRED` si no tenia sesion activa.
- [ ] Manual: webhook firmado de Stripe confirma pago aunque la tienda este
  cerrada.
- [ ] Manual: reset de contrasena rechaza claves que no cumplan la misma regla
  que registro.
- [ ] Manual: `POST /orders` queda limitado sin romper checkout normal.
- [ ] Manual: login, registro, admin, pedido, tracking y webhook no quedan
  bloqueados por `OriginGuard`.
- [ ] Manual: pago efectivo puede conciliarse como cobrado.
- [ ] Manual: Playwright cubre los flujos criticos antes de seguir con features
  grandes.
