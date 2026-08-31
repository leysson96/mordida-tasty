# Mordida Tasty - Guia de despliegue

Estado: el codigo ya esta preparado para desplegar, pero produccion no puede
quedar cerrada sin credenciales reales: dominio, base PostgreSQL, Stripe live,
SMTP, almacenamiento persistente de imagenes y textos legales finales.

## Comandos de produccion

Build completo:

```bash
npm ci --include=dev
npm run prisma:generate:prod -w @mordida/api
npm run build
npm prune --omit=dev
```

Migraciones:

```bash
npm run prisma:deploy -w @mordida/api
```

Arranque API:

```bash
npm run start -w @mordida/api
```

Arranque web:

```bash
npm run start -w @mordida/web
```

## Opcion recomendada para el primer lanzamiento: Render

Usar tres recursos:

- PostgreSQL gestionado.
- Servicio web Node para `mordida-tasty-api`.
- Servicio web Node para `mordida-tasty-web`.
- Persistent Disk para las imagenes subidas por admin, montado en
  `/opt/render/project/src/uploads` si usas el runtime Node nativo de Render.
  Si despliegas con Docker, usa `/app/uploads`.

Como este repositorio usa npm workspaces, deja el root directory en la raiz del
repositorio y usa comandos filtrados por workspace.

API:

```bash
Build Command:
npm ci --include=dev && npm run prisma:generate:prod -w @mordida/api && npm run build -w @mordida/api && npm prune --omit=dev

Pre-Deploy Command:
npm run prisma:deploy -w @mordida/api

Start Command:
npm run start -w @mordida/api

Health Check Path:
/health
```

Disco persistente de la API:

```bash
Mount Path:
/opt/render/project/src/uploads
```

Nota: el disco persistente y el pre-deploy command requieren servicio compatible
de pago en Render. No recomiendo lanzar produccion real en un plan sin disco,
porque las fotos subidas desde admin se perderian al redeplegar.

Web:

```bash
Build Command:
npm ci --include=dev && npm run build -w @mordida/web && npm prune --omit=dev

Start Command:
npm run start -w @mordida/web
```

Si Render muestra que faltan paquetes como `@types/react`, no significa que
falten en el repositorio. Significa que `NODE_ENV=production` hizo que `npm ci`
omitiera las dependencias de desarrollo. Mantener `--include=dev` en el build
lo corrige; `npm prune --omit=dev` limpia despues de compilar.

La plantilla `deploy/render.yaml.example` deja esos comandos preparados, pero
hay que cambiar los dominios `tudominio.es` por los reales antes de usarla.

## Opcion AWS

Usa los Dockerfiles:

```bash
docker build -f apps/api/Dockerfile -t mordida-tasty-api .
docker build -f apps/web/Dockerfile --build-arg NEXT_PUBLIC_API_URL=https://api.tudominio.es -t mordida-tasty-web .
```

Para AWS, la forma mas directa es publicar esas imagenes en un registro y
levantarlas en App Runner o ECS con:

- `DATABASE_URL` apuntando a RDS PostgreSQL.
- secretos en Secrets Manager o variables protegidas del servicio.
- volumen persistente para `UPLOAD_DIR` o sustitucion por S3/R2.
- HTTPS y dominio propio delante de web y API.

Ejecuta `npm run prisma:deploy -w @mordida/api` como paso separado de
release/migracion antes de mover trafico a la nueva version.

## Cloudflare

Con el codigo actual, Cloudflare encaja muy bien para DNS, SSL, CDN y reglas de
seguridad delante de la web/API. No recomiendo tratar esta app Next.js como una
web estatica pura: necesita servidor Node para las rutas actuales y para servir
la experiencia con cookies.

## Orden exacto del primer deploy

1. Comprar o conectar dominio.
2. Crear PostgreSQL gestionado.
3. Crear SMTP real y verificar remitente.
4. Crear cuenta Stripe live y webhook hacia `/payments/webhook`.
5. Crear almacenamiento persistente para `UPLOAD_DIR`.
6. Cargar variables de `.env.production.example` en el proveedor.
7. Ejecutar build.
8. Ejecutar migraciones con `prisma:deploy`.
9. Ejecutar `seed:prod` una vez.
10. Entrar como admin, activar 2FA y revisar ajustes.
11. Cargar portada, categorias, productos y fotos reales desde `/admin/menu`.
12. Entrar como cocina en `/admin/cocina`.
13. Hacer compra real de prueba con un producto barato.
14. Revisar pedido, correo, tracking, webhook, ticket y reportes.

## Verificacion minima antes de abrir al publico

```bash
npm run lint
npm test
npm run build
```

Ademas, en produccion revisa:

- `GET /health` responde `ok: true`.
- registro envia correo real.
- recuperacion de contrasena envia correo real.
- Stripe redirige a seguimiento con `orderNumber` y `trackingToken`.
- una imagen subida desde `/admin/menu` se ve despues en la carta publica.
- cocina solo puede ver y mover pedidos operativos.
- admin no entra al panel sin 2FA activado.

## Recuperacion de 2FA admin

Si el administrador pierde el codigo 2FA, usa una consola segura del proveedor:

```bash
npm run admin:reset-2fa -- --email=admin@tudominio.es
```

Este comando solo desactiva 2FA de ese usuario admin. No modifica contrasena,
pedidos, productos ni ajustes.
