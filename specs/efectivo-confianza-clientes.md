# Control de efectivo por confianza de cliente

## Contexto

- El backend usa NestJS, Prisma y PostgreSQL en `apps/api`.
- El frontend usa Next.js en `apps/web`.
- Ya existen pedidos con `OrderPaymentMethod.CASH`, estados `OrderStatus.CANCELLED` y cobro de efectivo desde admin.
- Ya existe historial de estados en `OrderStatusHistory` y auditoria admin en `AuditLog`.
- El checkout permite elegir tarjeta o efectivo, pero hoy no hay una regla de confianza por cliente.
- Cocina no debe poder cancelar pedidos por incidencia ni desbloquear metodos de pago.

## Objetivo

Permitir efectivo solo a clientes confiables: cliente nuevo empieza solo con tarjeta, desbloquea efectivo tras 2 pedidos correctos, y si abandona un pedido en efectivo pierde efectivo hasta completar 5 pedidos correctos con tarjeta.

## Flujo

```text
SECUENCIA (orden temporal abajo)
1. Cliente -> Checkout: abre la pantalla de pago
2. Checkout -> API: consulta si el cliente puede pagar en efectivo
3. API -> Checkout: devuelve estado de confianza y progreso
4. Checkout -> Cliente: muestra tarjeta y, solo si aplica, efectivo
5. Cliente -> API: crea pedido
6. API -> OrdersService: valida de nuevo si CASH esta permitido
7. Pedido correcto -> CashTrustService: suma progreso de confianza
8. Si llega a 2 pedidos correctos -> CashTrustService: habilita efectivo
9. Pedido efectivo abandonado -> Admin: cancela con motivo de incidencia
10. Admin -> API: marca incidencia de efectivo
11. API -> CashTrustService: bloquea efectivo y reinicia recuperacion
12. Cliente -> Checkout: solo puede pagar con tarjeta
13. Tras 5 pedidos correctos con tarjeta -> CashTrustService: recupera efectivo
```

```text
cliente entra al checkout
        |
        v
esta autenticado?
   | no
   v
solo tarjeta

   | si
   v
tiene efectivo habilitado?
   | si
   v
muestra tarjeta + efectivo

   | no
   v
muestra tarjeta + mensaje de progreso
        |
        v
pedido con tarjeta entregado sin incidencia?
   | no
   v
no suma progreso

   | si
   v
suma 1 pedido correcto
        |
        v
esta bloqueado por incidencia?
   | no
   v
necesita 2 correctos para efectivo

   | si
   v
necesita 5 correctos para recuperar efectivo
        |
        v
alcanzo el objetivo?
   | si
   v
habilitar efectivo
   | no
   v
seguir solo tarjeta

pedido en efectivo queda sin recoger / cliente no aparece
        |
        v
admin cancela con motivo grave
        |
        v
bloquear efectivo + reiniciar progreso de recuperacion
```

## Restricciones

- No tocar Stripe salvo para comprobar que el flujo de tarjeta sigue igual.
- No tocar descuentos, promociones ni calculo de precios.
- No permitir que cocina cancele por incidencia ni desbloquee efectivo.
- No confiar solo en el frontend: el backend debe rechazar `paymentMethod: "CASH"` si el cliente no tiene efectivo habilitado.
- Invitados o clientes sin sesion no pueden pagar en efectivo en esta primera version.
- Solo cuentan como pedidos correctos los pedidos finalizados como `DELIVERED` sin incidencia.
- Las incidencias graves que bloquean efectivo son:
  - `NO_PICKUP`: no recogio en local.
  - `NO_SHOW_DELIVERY`: no aparecio en entrega.
- Cancelaciones por culpa del local, falta de stock, error tecnico o cancelacion normal del cliente no bloquean efectivo.
- Sin librerias nuevas.
- Todo local primero; no push ni despliegue sin autorizacion explicita.

## Fuera de alcance

- Bloquear cuentas completas.
- Penalizaciones economicas o fianzas.
- Listas negras por IP, dispositivo o direccion.
- Reglas automaticas de fraude avanzadas.
- Reembolsos desde admin.
- Cambiar el flujo de cocina.

## Tareas

### T1: Modelo de confianza de efectivo

- **Hacer:** crear el modelo Prisma para guardar estado de efectivo por cliente, progreso, motivo de bloqueo y eventos de confianza.
- **Archivos:** `apps/api/prisma/schema.prisma`, nueva migracion Prisma, `apps/api/src/cash-trust/*`.
- **Verify:** test unitario del servicio: cliente nuevo empieza bloqueado, 2 pedidos correctos habilitan efectivo, incidencia bloquea y 5 pedidos correctos recuperan efectivo.

### T2: Validacion backend al crear pedido

- **Hacer:** integrar la regla en `createOrder`: si llega `paymentMethod: "CASH"` y el cliente no esta habilitado, rechazar con error claro.
- **Archivos:** `apps/api/src/orders/orders.service.ts`, `apps/api/src/orders/orders.service.spec.ts`.
- **Verify:** tests: invitado no puede efectivo, cliente con 0/1 pedido correcto no puede efectivo, cliente con 2 correctos si puede efectivo.

### T3: Sumar pedidos correctos al entregar

- **Hacer:** cuando un pedido pasa a `DELIVERED`, actualizar progreso de confianza segun la regla activa del cliente.
- **Archivos:** `apps/api/src/orders/orders.service.ts`, `apps/api/src/cash-trust/*`, tests de orders/cash-trust.
- **Verify:** entregar pedido con tarjeta suma progreso; pedidos cancelados, fallidos o expirados no suman.

### T4: Cancelar pedido efectivo por incidencia

- **Hacer:** crear accion admin para cancelar pedidos en efectivo pendientes de cobro con motivo grave (`NO_PICKUP`, `NO_SHOW_DELIVERY`) y bloquear efectivo al cliente.
- **Archivos:** `apps/api/src/admin/admin.controller.ts`, nuevo DTO de cancelacion de efectivo, `apps/api/src/orders` o `apps/api/src/payments` segun encaje actual.
- **Verify:** admin puede cancelar efectivo pendiente; cocina recibe 403; pedido queda `CANCELLED`; pago cash pendiente queda cerrado; cliente queda sin efectivo.

### T5: Checkout cliente

- **Hacer:** consultar estado de efectivo y mostrar/deshabilitar la opcion segun el resultado; mostrar progreso claro: "Completa 2 pedidos con tarjeta para activar efectivo" o "Completa 5 pedidos con tarjeta para recuperar efectivo".
- **Archivos:** `apps/web/app/checkout/page.tsx`, `apps/web/lib/types.ts`, CSS si hace falta.
- **Verify:** manual local: cliente nuevo solo ve tarjeta; cliente elegible ve tarjeta y efectivo; backend rechaza intento manual de efectivo si no esta habilitado.

### T6: Admin Pedidos

- **Hacer:** agregar boton en Pedidos para "Cancelar / no recogido" solo en pedidos CASH pendientes de cobro, con modal de motivo y confirmacion.
- **Archivos:** `apps/web/components/admin-orders-client.tsx`, `apps/web/app/globals.css`.
- **Verify:** en admin se ve la accion; cocina no la ve; cancelar actualiza la tarjeta del pedido y desaparece de activos si corresponde.

### T7: Reportes, cuenta y prueba final

- **Hacer:** asegurar que pedidos cancelados por incidencia no cuentan como cobrado/facturado; mostrar en cuenta del cliente el estado de efectivo; correr smoke test completo.
- **Archivos:** `apps/api/src/orders/orders.service.spec.ts`, `apps/web/app/cuenta/page.tsx`, `apps/web/lib/types.ts`.
- **Verify:** reportes separan cancelados; cuenta muestra progreso; smoke local: tarjeta activa confianza, efectivo funciona al desbloquear, incidencia bloquea, 5 tarjetas recuperan.

## Done (validacion final)

- [ ] Cliente invitado no puede pagar en efectivo.
- [ ] Cliente registrado nuevo no puede pagar en efectivo.
- [ ] Tras 2 pedidos `DELIVERED` sin incidencia, efectivo queda disponible.
- [ ] Pedido CASH no recogido o no aparecido se puede cancelar desde Pedidos.
- [ ] Cocina no puede cancelar por incidencia.
- [ ] La incidencia bloquea efectivo inmediatamente.
- [ ] Tras 5 pedidos correctos con tarjeta, efectivo se recupera automaticamente.
- [ ] Backend rechaza CASH aunque alguien fuerce el frontend.
- [ ] Reportes/caja no cuentan pedidos cancelados como cobrado.
- [ ] Lint, tests y build pasan en local.
