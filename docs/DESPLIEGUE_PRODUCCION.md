# Mordida Tasty - Guia de despliegue

Estado: el codigo ya esta preparado para desplegar, pero produccion no puede
quedar cerrada sin credenciales reales: dominio, base PostgreSQL, Stripe live,
SMTP, Cloudinary para imagenes y textos legales finales.

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

Imagenes de productos y portada:

Configura `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` y
`CLOUDINARY_API_SECRET` en el servicio API. El disco local de Render gratis es
efimero: las fotos guardadas ahi se pierden al reiniciar o redesplegar. Solo usa
`UPLOAD_DIR` como almacenamiento principal si tienes un disco persistente real.

Variables operativas importantes de API:

```text
FRONTEND_URL=https://mordidatasty.es
API_PUBLIC_URL=https://mordida-tasty-api.onrender.com
CORS_ORIGIN=https://mordidatasty.es,https://www.mordidatasty.es
CHECKOUT_GRACE_MINUTES=15
DELIVERY_COVERAGE_MODE=zones
```

Despues de cambiar estas variables, redepliega la API y prueba desde el dominio
real. `CORS_ORIGIN` y `FRONTEND_URL` afectan login, registro, admin, cookies,
correos y redirecciones de Stripe.

Nota: el pre-deploy command puede requerir un servicio compatible de pago en
Render. Si no esta disponible, ejecuta las migraciones desde una shell segura
antes del primer trafico real.

Web:

```bash
Build Command:
npm ci --include=dev && npm run build -w @mordida/web && npm prune --omit=dev

Start Command:
npm run start -w @mordida/web
```

Variables operativas importantes de la web:

```text
NEXT_PUBLIC_API_URL=https://mordida-tasty-api.onrender.com
NEXT_PUBLIC_GTM_ID=
NEXT_PUBLIC_GA_MEASUREMENT_ID=
```

Despues de cambiar cualquier `NEXT_PUBLIC_*`, usa `Save, rebuild, and deploy`.
Un restart simple no alcanza porque esos valores quedan compilados en el bundle
de Next.js.

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
- Cloudinary, S3/R2 o un volumen persistente real para imagenes subidas.
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
5. Crear Cloudinary o un almacenamiento persistente equivalente para imagenes.
6. Cargar variables de `.env.production.example` en el proveedor.
7. Ejecutar build.
8. Ejecutar migraciones con `prisma:deploy`.
9. Ejecutar `seed:prod` una vez.
10. Entrar como admin, activar 2FA y revisar ajustes.
11. Cargar portada, categorias, productos y fotos reales desde `/admin/menu`.
12. Entrar como cocina en `/admin/cocina`.
13. Hacer compra real de prueba con un producto barato.
14. Revisar pedido, correo, tracking, webhook, ticket y reportes.

## Runbook de cambios frecuentes

| Necesitas cambiar | Donde se hace | Deploy | Validacion |
| --- | --- | --- | --- |
| Google Tag Manager | Render Web: `NEXT_PUBLIC_GTM_ID` | Rebuild web | Aceptar cookies y probar Tag Assistant |
| Google Analytics directo | Render Web: `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Rebuild web | Confirmar evento en tiempo real |
| API que usa la web | Render Web: `NEXT_PUBLIC_API_URL` | Rebuild web | Home, checkout y cuenta cargan datos |
| Origenes permitidos | Render API: `CORS_ORIGIN` | Redeploy API | Login cliente/admin desde dominio real |
| URL publica del sitio | Render API: `FRONTEND_URL` | Redeploy API | Correos y Stripe vuelven al dominio correcto |
| Stripe | Render API + Stripe Dashboard | Redeploy API | Pago test y webhook `2xx` |
| Brevo/correo | Render API: `BREVO_*` o SMTP | Redeploy API | Registro, verificar email, recuperar contrasena |
| Cloudinary | Render API: `CLOUDINARY_*` | Redeploy API | Subir imagen y reiniciar API |
| Google Maps | Admin `/admin/menu` -> `Portada` | No | Boton `Como llegar` abre el punto exacto |
| Nosotros/portada/redes | Admin `/admin/menu` -> `Portada` | No | Home desktop/mobile correcta |
| Zonas de reparto | Admin + `DELIVERY_COVERAGE_MODE` si aplica | Solo variable | Codigo permitido y fuera de zona |
| Efectivo | Operacion diaria en admin | No | Marcar cobrado y revisar reportes |

## Verificacion minima antes de abrir al publico

```bash
npm run lint
npm test
npm run build
npm.cmd run test:e2e
```

Ademas, en produccion revisa:

- `GET /health` responde `ok: true`.
- registro envia correo real.
- recuperacion de contrasena envia correo real.
- Stripe redirige a seguimiento con `orderNumber` y `trackingToken`.
- una imagen subida desde `/admin/menu` se ve despues en la carta publica.
- cocina solo puede ver y mover pedidos operativos.
- admin no entra al panel sin 2FA activado.
- pedido efectivo de recogida y delivery se puede marcar como cobrado.
- reportes separan cobrado, efectivo pendiente y cancelado.
- Google Maps abre la direccion exacta desde movil.
- GTM/GA solo carga tras aceptar cookies.

## Rollback

Para corregir produccion, prioriza revertir por commit o desplegar un hotfix
pequeno. No mezcles rollback con nuevas features.

Flujo recomendado:

1. Identifica el commit sano con `git log --oneline`.
2. Revisa logs de Render API/Web y Stripe si el fallo toca pagos.
3. Revert seguro:

```bash
git revert <commit>
git push
```

4. Espera el deploy de Render.
5. Repite el smoke test del flujo afectado.

Si el cambio pendiente toca pagos, caja, migraciones o datos existentes, toma
backup antes de aplicar hotfix o rollback.

## Recuperacion de 2FA admin

Si el administrador pierde el codigo 2FA, usa una consola segura del proveedor:

```bash
npm run admin:reset-2fa -- --email=admin@tudominio.es
```

Este comando solo desactiva 2FA de ese usuario admin. No modifica contrasena,
pedidos, productos ni ajustes.
