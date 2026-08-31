# Mordida Tasty - Ampliacion admin profesional

Estado: guia de trabajo creada el 2026-08-30.

Este documento define como vamos a ampliar el panel admin sin romper lo que ya
funciona: pedidos, checkout, Stripe, cocina, productos, categorias, imagenes,
cookies `httpOnly`, 2FA y reportes actuales.

## Objetivo

Convertir el admin en una herramienta diaria para operar el restaurante sin
tocar codigo:

- Gestion de empleados/admin/cocina.
- Cierres especiales, vacaciones y pausa temporal de pedidos.
- Zonas de reparto, pedidos minimos y costes por zona.
- Busqueda y filtros avanzados de pedidos.
- Cancelacion completa con reembolso real.
- Opciones y extras de productos.
- Reportes avanzados y exportacion.

## Reglas para no danar lo existente

- Cada cambio debe ser aditivo: nuevas tablas, campos opcionales o endpoints
  nuevos. No se borran columnas ni se cambian contratos publicos sin migracion
  controlada.
- No se toca el flujo de checkout que ya funciona salvo cuando el modulo lo
  requiera de forma explicita, por ejemplo zonas de reparto.
- No se vuelve a guardar ningun token de sesion en `localStorage`.
- No se hardcodean ajustes operativos: horarios, cierres, envio, zonas, portada
  y productos deben venir de admin o base de datos.
- Admin y cocina siguen separados: `/admin` para gestion, `/admin/cocina` para
  operacion de cocina.
- El header publico de cliente no debe mostrar acceso visible a admin.
- Toda accion sensible de admin debe dejar `AuditLog`.
- Cada modulo se cierra con:
  `npm run test -w @mordida/api`, `npm run lint` y `npm run build`.
- Si aparece codigo duplicado en estados, horarios, errores o calculos de dinero,
  se centraliza antes de seguir ampliando.

## Estado actual reutilizable

- `User` ya tiene `role`: `CLIENTE`, `ADMIN`, `KITCHEN`.
- `Setting` ya guarda IVA, envio, horarios y contenido visual.
- `AuditLog` ya registra acciones administrativas.
- `Payment`, `PaymentRefund` y Stripe ya permiten reembolsos parciales.
- `OrderStatusHistory` ya guarda cambios de estado.
- `UploadsService` ya permite imagenes desde ordenador hacia `/uploads`.
- `ProductsService` ya gestiona productos y categorias activas/ocultas.

## Orden de implementacion

### 1. Gestion de staff

Estado: implementado.

Objetivo: crear y administrar usuarios internos desde admin.

Backend:

- Reutilizar `User`.
- Agregar campos seguros si hacen falta:
  - `active Boolean @default(true)` implementado.
  - `disabledAt DateTime?` implementado.
  - `lastLoginAt DateTime?` no implementado por ahora para evitar guardar un
    dato que todavia no usamos.
- Crear servicio/controlador admin para usuarios internos.
- Endpoints previstos:
  - `GET /admin/users` implementado.
  - `POST /admin/users` implementado.
  - `PATCH /admin/users/:id` implementado.
  - `PATCH /admin/users/:id/status` implementado.
  - `POST /admin/users/:id/reset-2fa` implementado.
  - `POST /admin/users/:id/password-reset` implementado.
- Bloquear desactivar el ultimo admin activo.
- Bloquear que cocina gestione usuarios.
- Registrar cambios en `AuditLog`.

Frontend:

- Nueva pantalla `/admin/staff` implementada.
- Lista de usuarios internos con rol, estado, 2FA y fecha de creacion
  implementada.
- Crear empleado con rol `ADMIN` o `KITCHEN` implementado.
- Desactivar/reactivar usuario implementado.
- Resetear 2FA desde interfaz segura implementado.
- Enviar recuperacion de contrasena implementado.

Pruebas:

- Crear admin/cocina cubierto.
- Evitar ultimo admin inactivo cubierto.
- Evitar que el admin desactive su propia sesion cubierto.
- Usuarios desactivados no pueden iniciar sesion ni conservar sesion activa
  cubierto.
- Reset 2FA deja el usuario listo para volver a configurarlo cubierto.

Archivos principales:

- `apps/api/prisma/schema.prisma`.
- `apps/api/src/admin/staff.service.ts`.
- `apps/api/src/admin/admin-staff.controller.ts`.
- `apps/web/components/admin-staff-client.tsx`.
- `apps/web/app/admin/staff/page.tsx`.

### 2. Cierres especiales y pausa temporal

Estado: implementado.

Objetivo: cerrar pedidos desde admin sin cambiar codigo.

Backend:

- Crear modelo `SpecialClosure` o equivalente:
  - `id` implementado.
  - `startsAt` implementado.
  - `endsAt` implementado.
  - `reason` implementado.
  - `active` implementado.
  - `createdById` implementado.
  - `createdAt` implementado.
- Agregar ajuste de pausa inmediata:
  - `orders_paused` implementado.
  - `orders_pause_reason` implementado.
- `SettingsService.isOpenNow()` debe considerar:
  - horario semanal implementado;
  - rangos nocturnos implementado;
  - pausas implementado;
  - cierres especiales implementado.
- El checkout debe rechazar pedidos cuando el servicio este cerrado por pausa o
  cierre especial, usando el motivo publico configurado.

Frontend:

- En `/admin`, bloque `Servicio` implementado.
- Boton para pausar/reanudar pedidos implementado.
- Formulario para cierre por dia, rango horario, vacaciones o festivo
  implementado.
- Edicion y desactivacion de cierres especiales implementada.
- Motivo de cierre visible en home/checkout cuando aplique implementado.

Pruebas:

- Cerrado por pausa cubierto.
- Cerrado por rango especial cubierto.
- Abierto si no hay cierre y horario semanal permite pedidos cubierto mediante
  los tests existentes de horario.
- El motivo se usa para bloquear checkout y se expone via `serviceStatus`
  cubierto.
- Auditoria de pausa y cierre especial cubierta.

Archivos principales:

- `apps/api/prisma/schema.prisma`.
- `apps/api/src/settings/settings.service.ts`.
- `apps/api/src/admin/admin.controller.ts`.
- `apps/web/components/admin-orders-client.tsx`.
- `apps/web/components/menu-client.tsx`.
- `apps/web/app/checkout/page.tsx`.

### 3. Zonas de reparto

Estado: implementado.

Objetivo: controlar donde se reparte, coste por zona y pedido minimo.

Backend:

- Crear modelo `DeliveryZone`:
  - `id` implementado.
  - `name` implementado.
  - `postalCodes Json` implementado con codigos exactos y prefijos `150*`.
  - `deliveryFeeCents` implementado.
  - `minimumOrderCents` implementado.
  - `active` implementado.
  - `sortOrder` implementado.
  - `createdAt` implementado.
  - `updatedAt` implementado.
- El checkout backend valida `deliveryPostalCode` implementado.
- Para `DELIVERY`, el coste de envio sale de la zona implementado.
- `deliveryFeeCents` global queda como fallback cuando todavia no hay zonas
  activas configuradas.
- Endpoint publico de cotizacion `GET /settings/delivery-quote` implementado.
- Endpoints admin protegidos implementados:
  - `GET /admin/delivery-zones`.
  - `POST /admin/delivery-zones`.
  - `PATCH /admin/delivery-zones/:id`.
  - `DELETE /admin/delivery-zones/:id`.
- Cambios sensibles registrados en `AuditLog`.

Frontend:

- Nueva pantalla `/admin/reparto` implementada.
- Crear/editar/desactivar/reactivar zonas implementado.
- Checkout muestra error claro si el codigo postal no esta cubierto
  implementado.
- Resumen del checkout muestra envio real calculado por backend mediante
  endpoint publico implementado.
- Pedido por debajo del minimo de la zona queda bloqueado antes de crear el
  pedido.

Pruebas:

- Codigo postal cubierto aplica coste correcto cubierto.
- Codigo postal por prefijo aplica coste correcto cubierto.
- Codigo postal fuera de zona no permite pedido cubierto.
- Pedido por debajo del minimo no permite checkout cubierto.
- Recogida no aplica zona ni coste de reparto cubierto por flujo existente.

Archivos principales:

- `apps/api/prisma/schema.prisma`.
- `apps/api/src/settings/delivery-zones.service.ts`.
- `apps/api/src/settings/settings.controller.ts`.
- `apps/api/src/orders/orders.service.ts`.
- `apps/api/src/admin/admin.controller.ts`.
- `apps/web/components/admin-delivery-client.tsx`.
- `apps/web/app/admin/reparto/page.tsx`.
- `apps/web/app/checkout/page.tsx`.

### 4. Busqueda y filtros de pedidos

Estado: implementado.

Objetivo: que admin pueda trabajar con muchos pedidos sin perderse.

Backend:

- Ampliar `GET /admin/orders` con filtros:
  - `q` por numero, email, nombre, telefono o codigo postal implementado.
  - `status` implementado.
  - `from` implementado.
  - `to` implementado.
  - `deliveryMethod` implementado.
  - paginacion basica con `page` y `pageSize` implementada.
- Compatibilidad con `today=true` mantenida.

Frontend:

- Buscador visible en `/admin` implementado.
- Filtros por estado, fecha y metodo implementados.
- Paginacion simple anterior/siguiente implementada.
- Contadores, alarma y tarjetas actuales conservados.

Pruebas:

- Filtra por texto cubierto.
- Filtra por estado cubierto.
- Filtra por metodo de entrega cubierto.
- Filtra por rango local usando `APP_TIMEZONE` cubierto.
- Mantiene `today=true` cubierto por prueba existente.

Archivos principales:

- `apps/api/src/orders/orders.service.ts`.
- `apps/api/src/admin/admin.controller.ts`.
- `apps/web/components/admin-orders-client.tsx`.
- `apps/api/src/orders/orders.service.spec.ts`.
- `apps/api/src/admin/admin.controller.spec.ts`.

### 5. Cancelacion completa con reembolso

Estado: implementado.

Objetivo: cancelar pedidos pagados desde admin con reembolso real y trazabilidad.

Backend:

- Crear metodo dedicado en pagos:
  `cancelPaidOrderWithRefund(orderId, reason, actorId)` implementado.
- Calcular importe reembolsable:
  total pagado menos reembolsos previos implementado.
- Crear reembolso Stripe con idempotencia por pedido implementado.
- Registrar `PaymentRefund` con `orderItemId` nulo para reembolso de pedido
  completo implementado.
- Mover pedido a `CANCELLED` solo despues de preparar o confirmar el reembolso
  implementado.
- Registrar `OrderStatusHistory` y `AuditLog` implementado.
- Mantener bloqueada la cancelacion directa de pedido pagado sin este flujo
  implementado por maquina de estados.

Frontend:

- Boton `Cancelar y reembolsar` solo para pedidos pagados o en cocina
  implementado.
- Modal con motivo obligatorio y resumen de importe a devolver implementado.
- Bloqueo contra doble clic implementado.

Pruebas:

- Reembolso completo de pedido pagado cubierto.
- No duplica reembolso si se reintenta cubierto.
- Resta reembolsos parciales previos cubierto.
- No cancela sin pago real de Stripe cubierto.
- Pedidos entregados no pasan por cancelacion completa cubierto.
- Cocina no tiene endpoint de cancelacion/reembolso completo por roles del
  controlador admin.

Archivos principales:

- `apps/api/src/payments/payments.service.ts`.
- `apps/api/src/admin/admin.controller.ts`.
- `apps/api/src/admin/dto/cancel-order.dto.ts`.
- `apps/web/components/admin-orders-client.tsx`.
- `apps/api/src/payments/payments.service.spec.ts`.
- `apps/api/src/admin/admin.controller.spec.ts`.

### 6. Opciones y extras de productos

Estado: implementado.

Objetivo: permitir personalizar platos sin crear mil productos duplicados.

Backend:

- Crear modelos:
  - `ProductOptionGroup` implementado.
  - `ProductOptionChoice` implementado.
  - `OrderItemOption` implementado.
- Soportar grupos obligatorios/opcionales:
  - elegir pan implementable desde admin;
  - quitar ingredientes implementable como opciones sin coste;
  - extras de queso/bacon/salsa implementable con precio;
  - bebida o tamano implementable por grupo de seleccion unica o multiple.
- El total del pedido calcula opciones en backend implementado.
- El checkout rechaza opciones inactivas, grupos que no pertenecen al producto
  y selecciones fuera de min/max implementado.
- El pedido guarda snapshot de grupo, opcion y precio en `OrderItemOption`
  implementado.
- Stripe recibe el nombre del producto con las opciones elegidas implementado.
- Cambios sensibles de grupos/opciones registrados en `AuditLog`
  implementado.

Frontend:

- En admin menu, crear/editar/desactivar grupos de opciones por producto
  implementado.
- En admin menu, crear/editar/desactivar opciones dentro de cada grupo
  implementado.
- En producto publico, mostrar selector de opciones antes de agregar al carrito
  implementado.
- En carta publica, si un producto tiene opciones, el boton lleva al
  configurador del producto para no saltarse reglas obligatorias implementado.
- En carrito, checkout, admin, cocina, seguimiento y ticket se muestran las
  opciones elegidas implementado.

Pruebas:

- Opcion extra suma precio en backend cubierto.
- Opcion obligatoria bloquea el pedido si falta cubierto.
- Pedido guarda opciones en snapshot aunque luego cambie el producto cubierto.
- Checkout Stripe muestra opciones en la linea de pago cubierto.
- Auditoria de creacion de grupo de opciones cubierta.

Archivos principales:

- `apps/api/prisma/schema.prisma`.
- `apps/api/src/products/products.service.ts`.
- `apps/api/src/orders/orders.service.ts`.
- `apps/api/src/payments/payments.service.ts`.
- `apps/api/src/admin/admin.controller.ts`.
- `apps/web/components/admin-menu-client.tsx`.
- `apps/web/components/product-detail-client.tsx`.
- `apps/web/components/menu-client.tsx`.
- `apps/web/components/cart-provider.tsx`.
- `apps/web/app/checkout/page.tsx`.
- `apps/web/components/admin-kitchen-client.tsx`.
- `apps/web/components/admin-orders-client.tsx`.

### 7. Reportes avanzados y exportacion

Objetivo: dar informacion util para decisiones del restaurante.

Backend:

- Endpoints para:
  - productos mas vendidos;
  - ventas por categoria;
  - ticket medio;
  - cancelaciones y reembolsos;
  - exportacion CSV.

Frontend:

- Mejorar `/admin/reportes`.
- Filtros por fecha.
- Boton exportar CSV.
- Tarjetas de resumen mas operativas.

Pruebas:

- Totales por rango.
- Productos mas vendidos excluyendo productos quitados.
- Reembolsos restan correctamente donde corresponda.

## Checklist por modulo

1. Revisar archivos existentes relacionados.
2. Crear migracion Prisma aditiva.
3. Actualizar DTOs con validacion.
4. Crear o ampliar servicio backend.
5. Crear endpoint admin protegido por roles/2FA.
6. Registrar acciones sensibles en `AuditLog`.
7. Actualizar tipos frontend.
8. Crear pantalla o bloque de admin.
9. Anadir estados de carga, error y doble clic.
10. Anadir pruebas.
11. Ejecutar tests, lint y build.
12. Actualizar esta guia y la hoja de ruta.

## Orden recomendado antes de produccion

1. Gestion de staff.
2. Cierres especiales y pausa temporal.
3. Zonas de reparto.
4. Busqueda/filtros de pedidos.
5. Cancelacion completa con reembolso.
6. Opciones y extras de productos.
7. Prueba e2e real con Postgres temporal y Stripe CLI.
8. Servicios reales: proveedor, dominio, Postgres, Stripe live, SMTP y
   almacenamiento persistente.
9. PWA instalable para clientes moviles.
10. Revision visual final con fotos reales y textos legales reales.
