# Auditoria tecnica de produccion - Mordida Tasty

Fecha: 2026-09-07

Alcance: revision local del monorepo, flujo web/API, seguridad de aplicacion,
pagos, pedidos, fidelidad, administracion, correo, SEO/configuracion y
operativa. No sustituye un pentest externo ni revision legal/fiscal formal.

## Estado general

El proyecto esta en un punto sano para pruebas de produccion controladas. La
arquitectura separa frontend y API, el backend recalcula precios, Stripe se
valida con webhook firmado, las sesiones usan cookies `httpOnly`, hay roles,
2FA para admin, rate limiting y las pantallas criticas ya compilan.

Validacion ejecutada:

- `npm.cmd run lint`: OK en API y web.
- `npm.cmd run test`: OK, 13 suites y 105 tests pasados.
- `npm.cmd run build`: OK, API y web compilan para produccion.
- `npm.cmd audit --workspaces --omit=dev`: 7 vulnerabilidades moderadas
  transitivas, sin parche disponible ahora mismo.

Estado Git al auditar:

- Sin cambios de codigo pendientes.
- Solo aparece `?? .codex/`, carpeta local de trabajo que no debe subirse.

## Lo que esta bien cubierto

- Autenticacion: contrasenas con `argon2`, tokens de verificacion/reset
  aleatorios y guardados hasheados.
- Cookies: sesiones `httpOnly`, `secure` en produccion y `sameSite` configurable.
- Roles: admin, cocina y cliente separados; hay tests E2E que bloquean accesos
  de cliente/cocina a rutas admin no permitidas.
- Stripe: el backend crea Checkout con importes del pedido calculado en servidor
  y valida webhook con `stripe.webhooks.constructEvent`.
- Pedidos: `Idempotency-Key` requerido al crear pedido para evitar duplicados.
- Tracking: acceso publico protegido con `trackingToken`.
- Tickets: la impresion admin/cocina usa un componente con datos de cliente,
  entrega, notas, productos, pago y total.
- Uploads: imagenes limitadas por tipo, tamano y firma real del archivo.
- Headers: Next oculta `X-Powered-By` y aplica CSP, HSTS, X-Frame-Options,
  Referrer-Policy y Permissions-Policy.
- Analytics: GTM/GA carga solo si el usuario acepta cookies de analitica y no en
  rutas `/admin`.
- Reportes: ya hay resumen, actividad diaria, productos mas vendidos e historial
  de pedidos con filtros.

## Hallazgos prioritarios

### P1 - Corregir antes de escalar usuarios reales

1. Politica de contrasena inconsistente en reset.
   `apps/api/src/auth/dto/register.dto.ts:19` exige mayuscula, minuscula y
   numero al registrar, pero `apps/api/src/auth/dto/password-reset.dto.ts:13`
   solo exige longitud. Un usuario puede registrarse fuerte y luego resetear a
   una clave mas debil.

   Accion: reutilizar la misma politica de password en registro, reset y staff.

2. Vulnerabilidades moderadas transitivas sin parche.
   `npm audit --omit=dev` reporta `qs` por dependencias de Express/Nest/Stripe.
   Indica "No fix available".

   Accion: mantener Dependabot activo, revisar alertas semanalmente y actualizar
   Nest/Stripe/Express solo cuando exista version compatible. No ejecutar
   `npm audit fix` a ciegas en produccion.

3. Checkout Stripe enlazado solo por `orderId`.
   `apps/api/src/payments/dto/create-checkout-session.dto.ts:5` solo recibe
   `orderId`, y `apps/api/src/orders/orders.service.ts:468` busca el pedido por
   ID. El precio sigue protegido porque sale del servidor, pero es mejor ligar
   la creacion de checkout al usuario autenticado o al `trackingToken` del
   pedido.

   Accion: cambiar el DTO para exigir `orderId + trackingToken`, o crear la
   sesion de Stripe dentro del mismo flujo que crea el pedido.

### P2 - Endurecimiento operativo recomendado

4. Pedidos publicos sin throttle explicito propio.
   `apps/api/src/orders/orders.controller.ts:13` permite crear pedidos con
   `OptionalJwtAuthGuard`. Esta bien para checkout invitado, pero ahora depende
   del limite global de 120/min.

   Accion: anadir `@Throttle` especifico a `POST /orders`, por ejemplo 10/min
   por IP, y considerar captcha si aparece abuso real.

5. `OriginGuard` permite mutaciones sin cabecera `Origin`.
   En `apps/api/src/common/guards/origin.guard.ts:20`, si no hay `Origin` se
   permite la peticion. Con cookies `SameSite=lax` el riesgo practico baja, pero
   es mejor endurecer rutas con cookie-auth.

   Accion: para metodos mutantes, aceptar sin `Origin` solo endpoints
   server-to-server conocidos, como Stripe webhook, o validar `Referer`.

6. Pagos en efectivo quedan internamente como `PENDING`.
   En `apps/api/src/orders/orders.service.ts:332`, el pago CASH se crea con
   `PaymentStatus.PENDING`. El pedido puede avanzar, pero si luego se usa la
   tabla `Payment` para caja/conciliacion aparecera pendiente.

   Accion: agregar flujo "efectivo cobrado" o marcar el pago CASH como cobrado
   al entregar/confirmar, segun operativa real del local.

7. Falta prueba E2E real de navegador para web.
   `package.json:17` ejecuta tests solo en API; `apps/web/package.json:9` solo
   tiene lint. No hay Playwright/Cypress para checkout, tracking, admin, reportes
   y responsive.

   Accion: crear suite Playwright con flujos minimos: registro/login, checkout
   efectivo, checkout Stripe mock, seguimiento, admin pedidos, cocina, reportes
   e impresion visual.

8. Analytics puede parecer "no detectado" si no hay consentimiento o redeploy.
   `apps/web/components/google-analytics.tsx:59` no carga GTM/GA si el usuario
   no acepto analitica, si esta en `/admin` o si no se desplego con la variable.

   Accion: documentar esto en admin y probar GTM en una sesion con cookies
   aceptadas despues del redeploy de Render.

### P3 - Mejoras de producto/negocio

9. Reportes necesitan capa de negocio.
   Ya existe historial en `apps/web/components/admin-reports-client.tsx:439`,
   pero faltan exportaciones y reportes para cierre de caja.

   Accion: anadir export CSV/PDF, desglose por metodo de pago, efectivo vs
   tarjeta, devoluciones, descuentos de fidelidad y ventas por franja horaria.

10. Politicas legales siguen con textos placeholder.
    `apps/web/app/privacidad/page.tsx:20` indica que faltan razon social,
    NIF/CIF, domicilio fiscal y revision RGPD/LSSI.

    Accion: completar textos reales antes de trafico publico serio.

11. CSP todavia usa `unsafe-inline`.
    `apps/web/next.config.ts:40` lo mantiene para compatibilidad con Next/GTM.

    Accion: dejarlo asi por ahora si todo funciona, y valorar CSP con nonce mas
    adelante cuando el producto este estable.

12. Ubicacion/Google Maps depende del enlace exacto guardado.
    `apps/web/components/menu-client.tsx:44` prioriza `googleMapsUrl`, y
    `apps/web/components/menu-client.tsx:357` solo usa direccion como fallback.

    Accion: guardar en admin el enlace exacto de Google Maps del negocio, no una
    direccion escrita a mano. Seria util anadir boton "Probar enlace" en admin.

## Hoja de ruta sugerida

### Fase 1 - Parche corto de seguridad

- Unificar politica de contrasena en reset.
- Endurecer checkout Stripe con `trackingToken`.
- Anadir throttle especifico a `POST /orders`.
- Revisar `OriginGuard` para mutaciones sin `Origin`.

### Fase 2 - Caja y operativa

- Definir estado real del pago en efectivo.
- Agregar accion admin/cocina "efectivo cobrado" si el restaurante lo necesita.
- Validar ticket impreso en pedidos de delivery con una prueba visual.

### Fase 3 - Pruebas de navegador

- Instalar Playwright.
- Cubrir mobile y desktop.
- Capturar pantallas automaticas de menu, checkout, tracking, admin, cocina y
  reportes.

### Fase 4 - Reportes profesionales

- Export CSV/PDF.
- Cierre de caja diario.
- Desglose por metodo de pago.
- Descuentos/fidelidad/devoluciones.
- Ranking por productos y franjas horarias.

### Fase 5 - Legal/marketing

- Completar politica de privacidad, condiciones y aviso legal con datos reales.
- Revisar consentimiento de cookies y textos legales.
- Documentar en admin como cambiar GTM/GA, Maps, portada, nosotros y negocio.

## Conclusiones

No veo un proyecto roto. Veo un producto que ya tiene base seria y que ahora
necesita endurecimiento de produccion: pruebas E2E, pequenos cierres de
seguridad, caja/efectivo y documentacion operacional. La prioridad no debe ser
meter mas funciones grandes hasta cerrar P1 y P2.
