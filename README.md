# Mordida Tasty

Monorepo de produccion para la Fase 1 del proyecto Mordida Tasty:

- `apps/api`: backend NestJS + TypeScript + Prisma + PostgreSQL + Stripe.
- `apps/web`: frontend Next.js + TypeScript para cliente y panel admin.

## Requisitos

- Node.js 22 o superior.
- PostgreSQL gestionado o local. Para desarrollo puedes usar Docker Compose.
- Cuenta de Stripe configurada.

## Arranque local

1. Copia `.env.example` a `.env` y completa los secretos. Para desarrollo local ya puedes usar el `.env` incluido en este workspace.
2. Instala dependencias:

```bash
npm install
```

3. Levanta PostgreSQL y el buzon de correo local:

```bash
docker compose up -d postgres mailpit
```

Tambien puedes usar el script:

```bash
npm run db:up
```

4. Genera Prisma y aplica migraciones:

```bash
npm run prisma:generate
npm run prisma:migrate
```

5. Crea datos iniciales:

```bash
npm run seed
```

6. Levanta API y web:

```bash
npm run dev
```

La API escucha en `http://localhost:4000` y la web en `http://localhost:3000`.
El buzon local de desarrollo escucha en `http://localhost:8025`.
Las imagenes subidas desde admin se guardan en `UPLOAD_DIR` y se sirven desde
`http://localhost:4000/uploads`.

El seed crea el admin con el email configurado en `MORDIDA_SEED_ADMIN_EMAIL` y la clave configurada en `MORDIDA_SEED_ADMIN_PASSWORD`.
Tambien puede crear una cuenta limitada de cocina con `MORDIDA_SEED_KITCHEN_EMAIL` y `MORDIDA_SEED_KITCHEN_PASSWORD`.

## Pantallas internas

- Panel administrador: `http://localhost:3000/admin`
- Gestion de carta, categorias, portada y fotos: `http://localhost:3000/admin/menu`
- Pantalla cocina: `http://localhost:3000/admin/cocina`

La cuenta de cocina solo debe usarse para operar pedidos activos. No tiene acceso a ajustes, reportes, menu ni reembolsos.
El administrador debe activar 2FA antes de usar el panel completo.

## Stripe webhook local

Configura el webhook hacia:

```text
http://localhost:4000/payments/webhook
```

Eventos necesarios:

- `checkout.session.completed`
- `checkout.session.expired`
- `payment_intent.payment_failed`

## Notas de lanzamiento

Antes de produccion faltan decisiones externas al codigo: dominio, claves Stripe live, SMTP real, textos legales RGPD/LSSI, fotos reales del menu, zonas de envio y confirmacion fiscal del IVA aplicable.

Documentacion operativa:

- Hoja de ruta: `docs/HOJA_RUTA_PRODUCCION.md`
- Manual Render paso a paso: `docs/MANUAL_RENDER_PASO_A_PASO.md`
- Variables reales: `docs/VARIABLES_PRODUCCION.md`
- Despliegue: `docs/DESPLIEGUE_PRODUCCION.md`
- Diseno y marca: `docs/DISENO_MARCA.md`

Validacion minima:

```bash
npm run lint
npm test
npm run build
```
