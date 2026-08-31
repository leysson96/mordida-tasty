# Implementacion Fase 1

Esta implementacion sigue la guia del PDF como especificacion de producto para el MVP a produccion.

## Cubierto en codigo

- Monorepo con backend `NestJS + TypeScript` y frontend `Next.js + TypeScript`.
- Prisma sobre PostgreSQL con migracion inicial versionada.
- Auth de cliente: registro, login, verificacion email y recuperacion.
- Auth de admin separado con soporte 2FA TOTP.
- Catalogo por categorias, productos activos y toggle `available`.
- Carrito persistente en navegador.
- Creacion de pedidos con `Idempotency-Key`.
- Snapshots inmutables de lineas de pedido y direccion.
- Totales: subtotal, descuento, envio, IVA incluido y total.
- Maquina de estados de pedidos e historial.
- Stripe Checkout y webhook idempotente con tabla `StripeEvent`.
- Panel admin: pedidos de hoy, cambios de estado, alarma sonora y ticket 80mm.
- Ajuste editable de IVA.
- Banner de cookies y solicitud de borrado de datos RGPD.
- Assets iniciales de menu en `apps/web/public/images/menu`.

## Pendiente externo antes de abrir pagos reales

- Dominio final y DNS.
- Cuenta Stripe verificada y claves live.
- Base PostgreSQL gestionada con backups.
- Razon social, NIF/CIF y direccion fiscal.
- Textos legales revisados por responsable legal.
- Fotos reales finales del menu.
- Zonas de envio, costes y horarios definitivos.
- Confirmacion fiscal del tipo de IVA aplicable.

## Validaciones ejecutadas

- `npm install`
- `npm run prisma:generate`
- `npm run lint`
- `npm run build`

## Arranque recomendado

1. Crear `.env` desde `.env.example` o usar el `.env` local de desarrollo.
2. Levantar PostgreSQL con `docker compose up -d postgres`.
3. Completar Stripe y SMTP cuando se vayan a probar pagos/emails reales.
4. Ejecutar `npm run prisma:migrate`.
5. Ejecutar `npm run seed`.
6. Ejecutar `npm run dev`.
