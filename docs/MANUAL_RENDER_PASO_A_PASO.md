# Mordida Tasty - Manual paso a paso para publicar en Render

Estado actual: el codigo ya esta en GitHub en
`https://github.com/leysson96/mordida-tasty.git`.

Objetivo: montar la aplicacion completa en produccion con Render, PostgreSQL,
Stripe, SMTP real, imagenes persistentes, admin, cocina y web publica.

## 0. Idea general

Este proyecto tiene tres piezas:

- Base de datos PostgreSQL: guarda usuarios, pedidos, productos, ajustes,
  horarios, zonas, extras, pagos y auditoria.
- API: backend NestJS. Gestiona auth, admin, cocina, pedidos, Stripe, emails e
  imagenes subidas desde el panel.
- Web: frontend Next.js. Muestra la carta al cliente, checkout, tracking,
  cuenta de cliente, admin y cocina.

En Render vamos a crear:

- `mordida-tasty-db`: base PostgreSQL.
- `mordida-tasty-api`: servicio web Node para la API.
- `mordida-tasty-web`: servicio web Node para la web.
- Un disco persistente en la API para fotos subidas desde admin.

Importante: el repositorio de GitHub guarda codigo, no secretos. Los secretos
van en el panel de Render, Stripe y el proveedor de correo.

## 1. Lo que ya esta hecho

- Git local inicializado.
- Primer commit creado.
- Proyecto subido a GitHub.
- `.env`, `.env.local`, `node_modules`, `.next`, `dist`, `uploads` y capturas
  temporales ignoradas por Git.
- Codigo validado localmente con lint, build y tests antes de subir.

## 2. Lo que necesitas antes de abrir al publico

Puedes hacer un primer despliegue de prueba sin dominio propio usando URLs
`onrender.com`, pero para abrir al publico recomiendo tener:

- Cuenta Render.
- Cuenta Stripe.
- SMTP real para enviar correos.
- Dominio propio, por ejemplo `mordidatasty.es`.
- Email de administrador real.
- Email de cocina real.
- Fotos reales del restaurante/productos.
- Textos legales finales: aviso legal, privacidad y condiciones.

Para produccion real no recomiendo el plan gratuito si vas a usar subida de
imagenes desde admin. La API necesita disco persistente para no perder fotos al
redeplegar.

## 3. Sobre los archivos `.env`

No borres tu `.env` local si quieres seguir probando en tu ordenador. Ese
archivo no se subio a GitHub y no debe subirse nunca.

En produccion no se copia el `.env` al servidor. En Render se agregan las
variables desde:

```text
Service -> Environment -> Add Environment Variable
```

Si alguna clave real se filtra por accidente, hay que rotarla: crear una clave
nueva en el servicio correspondiente y borrar la antigua.

## 4. Orden recomendado

Sigue este orden:

1. Crear base de datos PostgreSQL en Render.
2. Crear servicio API en Render.
3. Crear servicio Web en Render.
4. Ajustar URLs reales de API/Web en variables.
5. Crear webhook de Stripe.
6. Configurar SMTP real.
7. Ejecutar seed de produccion una sola vez.
8. Entrar como admin y activar 2FA.
9. Configurar negocio, horarios, zonas, carta, extras, portada y redes.
10. Hacer prueba completa antes de abrir al publico.

## 5. Crear la base de datos en Render

Entra en:

```text
https://dashboard.render.com
```

Pasos:

1. Pulsa `New`.
2. Elige `PostgreSQL`.
3. Nombre: `mordida-tasty-db`.
4. Database name: `mordida_tasty`.
5. User: `mordida`.
6. Region: `Frankfurt`.
7. Plan: el que elijas para produccion.
8. Crea la base.

Cuando este creada:

1. Entra en la base de datos.
2. Abre `Connect` o `Info`.
3. Copia la `Internal Database URL`.

Usa la URL interna para la API si la API tambien esta en Render y en la misma
region. La URL externa es para conectar desde fuera de Render.

## 6. Crear la API en Render

En Render:

1. Pulsa `New`.
2. Elige `Web Service`.
3. Elige GitHub como proveedor.
4. Selecciona el repo `leysson96/mordida-tasty`.
5. Configura:

```text
Name: mordida-tasty-api
Runtime: Node
Region: Frankfurt
Branch: main
Root Directory: dejar vacio
Build Command:
npm ci --include=dev && npm run prisma:generate:prod -w @mordida/api && npm run build -w @mordida/api && npm prune --omit=dev

Pre-Deploy Command:
npm run prisma:deploy -w @mordida/api

Start Command:
npm run start -w @mordida/api

Health Check Path:
/health
```

En `Advanced`, crea un Persistent Disk:

```text
Disk name: mordida-tasty-uploads
Mount path: /opt/render/project/src/uploads
Size: 1 GB
```

Variables de entorno de la API:

```text
NODE_ENV=production
NODE_VERSION=22.19.0
APP_TIMEZONE=Europe/Madrid
DATABASE_URL=pegar Internal Database URL de Render PostgreSQL
FRONTEND_URL=https://mordida-tasty-web.onrender.com
API_PUBLIC_URL=https://mordida-tasty-api.onrender.com
CORS_ORIGIN=https://mordida-tasty-web.onrender.com
JWT_SECRET=crear secreto largo aleatorio
JWT_EXPIRES_IN=7d
ADMIN_JWT_EXPIRES_IN=12h
SESSION_COOKIE_DOMAIN=
SESSION_COOKIE_SAME_SITE=none
STRIPE_SECRET_KEY=sk_test_o_sk_live_de_Stripe
STRIPE_WEBHOOK_SECRET=whsec_temporal_cambiar_despues
STRIPE_SUCCESS_PATH=/seguimiento/{ORDER_NUMBER}?t={TRACKING_TOKEN}
STRIPE_CANCEL_PATH=/checkout?cancelled=1
SMTP_HOST=smtp_real
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=usuario_smtp
SMTP_PASSWORD=password_smtp
SMTP_FROM=Mordida Tasty <no-reply@tudominio.es>
UPLOAD_DIR=/opt/render/project/src/uploads
UPLOAD_MAX_BYTES=5242880
MORDIDA_SEED_ADMIN_EMAIL=tu_email_admin_real
MORDIDA_SEED_ADMIN_PASSWORD=contrasena_temporal_larga
MORDIDA_SEED_KITCHEN_EMAIL=email_cocina_real
MORDIDA_SEED_KITCHEN_PASSWORD=contrasena_temporal_larga_cocina
```

Notas:

- Si todavia no tienes dominio propio, usa las URLs `onrender.com`.
- Si luego el nombre real del servicio cambia, actualiza `FRONTEND_URL`,
  `API_PUBLIC_URL` y `CORS_ORIGIN`.
- `SESSION_COOKIE_SAME_SITE=none` es lo mas practico mientras web y API esten
  en subdominios temporales de Render.
- Cuando uses dominio propio tipo `www.tudominio.es` y `api.tudominio.es`, usa
  `SESSION_COOKIE_SAME_SITE=lax`.
- Deja `SESSION_COOKIE_DOMAIN` vacio al principio.

Cuando guardes, Render empezara a construir y desplegar la API.

## 7. Crear la web en Render

En Render:

1. Pulsa `New`.
2. Elige `Web Service`.
3. Selecciona el mismo repo `leysson96/mordida-tasty`.
4. Configura:

```text
Name: mordida-tasty-web
Runtime: Node
Region: Frankfurt
Branch: main
Root Directory: dejar vacio
Build Command:
npm ci --include=dev && npm run build -w @mordida/web && npm prune --omit=dev

Start Command:
npm run start -w @mordida/web
```

Variables de entorno de la web:

```text
NODE_ENV=production
NODE_VERSION=22.19.0
NEXT_PUBLIC_API_URL=https://mordida-tasty-api.onrender.com
```

Importante: `NEXT_PUBLIC_API_URL` queda metida dentro del build de Next.js.
Si cambias esa variable, usa `Save, rebuild, and deploy`, no solo reiniciar.

Si Render muestra un error diciendo que falta `@types/react`, el origen es que
el servicio esta construyendo con `NODE_ENV=production` y `npm ci` omitio las
dependencias de desarrollo. Solucion: confirma que el `Build Command` de la web
usa exactamente:

```text
npm ci --include=dev && npm run build -w @mordida/web && npm prune --omit=dev
```

Haz el mismo ajuste en la API:

```text
npm ci --include=dev && npm run prisma:generate:prod -w @mordida/api && npm run build -w @mordida/api && npm prune --omit=dev
```

## 8. Revisar que API y web se ven

Cuando Render termine:

1. Abre la API:

```text
https://mordida-tasty-api.onrender.com/health
```

Debe responder algo tipo `ok`.

2. Abre la web:

```text
https://mordida-tasty-web.onrender.com
```

Debe verse la pagina publica.

3. Si la web abre pero no carga productos, revisa:

- `NEXT_PUBLIC_API_URL` en la web.
- `CORS_ORIGIN` en la API.
- Logs de la API.
- Que las migraciones hayan corrido.

## 9. Crear el webhook de Stripe

En Stripe:

1. Entra al Dashboard de Stripe.
2. Ve a `Developers`.
3. Ve a `Webhooks`.
4. Pulsa `Add endpoint`.
5. URL:

```text
https://mordida-tasty-api.onrender.com/payments/webhook
```

6. Eventos necesarios:

```text
checkout.session.completed
checkout.session.expired
payment_intent.payment_failed
```

7. Guarda el endpoint.
8. Copia el `Signing secret`, empieza por `whsec_`.
9. Vuelve a Render -> API -> Environment.
10. Cambia:

```text
STRIPE_WEBHOOK_SECRET=whsec_real_de_stripe
```

11. Guarda y redepliega la API.

Si luego pones dominio propio para la API, crea o actualiza el webhook a:

```text
https://api.tudominio.es/payments/webhook
```

## 10. Configurar SMTP real

Necesitas un servicio de correo transaccional. Puede ser Brevo, SendGrid,
Mailgun, SMTP2GO, Amazon SES u otro similar.

Para empezar de forma sencilla, una opcion practica es Brevo:

1. Crea una cuenta en `https://www.brevo.com`.
2. Entra al panel de Brevo.
3. Verifica tu remitente o, mejor, autentica tu dominio.
4. Ve a la zona de SMTP/transaccional.
5. Crea o copia tus credenciales SMTP.
6. Usa estos valores en Render, dentro del servicio API:

```text
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=tu_login_smtp_de_brevo
SMTP_PASSWORD=tu_clave_smtp_de_brevo
SMTP_FROM=Mordida Tasty <no-reply@tudominio.es>
```

Importante: en Brevo se usa clave SMTP para SMTP, no la API key normal.
Si todavia no tienes dominio, puedes verificar un remitente temporal, pero para
produccion real conviene autenticar el dominio para mejorar entregabilidad.

Datos que necesitas:

```text
SMTP_HOST
SMTP_PORT
SMTP_SECURE
SMTP_USER
SMTP_PASSWORD
SMTP_FROM
```

Recomendacion habitual:

```text
SMTP_PORT=587
SMTP_SECURE=false
```

Para puerto `465`, normalmente:

```text
SMTP_SECURE=true
```

Despues de guardar SMTP en Render, prueba:

1. Registro de cliente.
2. Verificacion de email.
3. Recuperacion de contrasena.

Sin SMTP real, el cliente no podra verificar correo ni recuperar contrasena.

## 11. Ejecutar el seed de produccion

El seed crea el admin inicial, el usuario de cocina y datos base si faltan. No
pisa contrasenas ni ajustes si ya existen.

Cuando la API ya este desplegada:

1. En Render entra al servicio `mordida-tasty-api`.
2. Abre `Shell`.
3. Ejecuta:

```bash
npm run seed:prod -w @mordida/api
```

Si Render no te deja abrir Shell, probablemente el servicio no es compatible
con esa funcion. Para produccion real, usa un plan que permita Shell o
coordinamos un metodo alternativo seguro.

Despues del seed:

1. Entra a:

```text
https://mordida-tasty-web.onrender.com/admin/login
```

2. Inicia sesion con:

```text
MORDIDA_SEED_ADMIN_EMAIL
MORDIDA_SEED_ADMIN_PASSWORD
```

3. Activa 2FA desde `/admin/2fa`.
4. Guarda el codigo en una app autenticadora.
5. Entra a Staff y crea usuarios reales si hace falta.
6. Cambia contrasenas temporales.

Cuando confirmes que el admin existe y entra bien, puedes borrar de Render las
variables `MORDIDA_SEED_ADMIN_PASSWORD` y `MORDIDA_SEED_KITCHEN_PASSWORD`.

## 12. Configurar el negocio desde admin

Desde el panel admin revisa:

- Estado del servicio: abierto, pausado o cerrado por horario.
- Motivo de pausa.
- Cierres especiales.
- IVA.
- Coste de envio base.
- Horarios por dia.
- Zonas de reparto por codigo postal.
- Pedido minimo por zona.
- Staff y usuarios de cocina.
- Portada, textos, nombre, logo, fuente y redes.
- Categorias de menu.
- Productos.
- Extras/opciones.
- Imagenes de portada y productos.

La pantalla de cocina es:

```text
/admin/cocina
```

Esa es la pantalla que deberia quedar abierta en cocina para recibir pedidos.

## 13. Dominio propio

Puedes probar primero con `onrender.com`. Para abrir al publico, mejor dominio
propio:

```text
www.tudominio.es -> web
api.tudominio.es -> API
```

En Render:

1. Entra al servicio web.
2. Ve a `Settings`.
3. Busca `Custom Domains`.
4. Agrega `www.tudominio.es`.
5. Repite en la API agregando `api.tudominio.es`.

En el proveedor DNS:

- Crea un registro CNAME para `www` apuntando al subdominio Render de la web.
- Crea un registro CNAME para `api` apuntando al subdominio Render de la API.
- Elimina registros `AAAA` si interfieren con Render.

Despues actualiza variables:

API:

```text
FRONTEND_URL=https://www.tudominio.es
API_PUBLIC_URL=https://api.tudominio.es
CORS_ORIGIN=https://www.tudominio.es,https://tudominio.es
SESSION_COOKIE_SAME_SITE=lax
SESSION_COOKIE_DOMAIN=
```

Web:

```text
NEXT_PUBLIC_API_URL=https://api.tudominio.es
```

Despues de cambiar `NEXT_PUBLIC_API_URL`, haz `Save, rebuild, and deploy` en la
web.

Tambien actualiza el webhook de Stripe a:

```text
https://api.tudominio.es/payments/webhook
```

## 14. Prueba completa antes de abrir

Haz esta prueba en orden:

1. Abrir home publica.
2. Ver que la portada carga.
3. Ver categorias y productos.
4. Crear cuenta de cliente.
5. Recibir correo de verificacion.
6. Verificar email.
7. Iniciar sesion cliente.
8. Agregar producto al carrito.
9. Seleccionar extras.
10. Ir a checkout.
11. Probar envio con codigo postal permitido.
12. Probar codigo postal fuera de zona.
13. Crear pedido.
14. Pagar con Stripe.
15. Confirmar que redirige al seguimiento.
16. Confirmar que el pedido aparece en admin.
17. Confirmar que cocina ve el pedido.
18. Cambiar estados desde cocina.
19. Ver que el cliente ve el tracking actualizado.
20. Imprimir ticket.
21. Revisar reportes.
22. Subir una imagen desde admin.
23. Redeplegar o reiniciar API.
24. Confirmar que la imagen sigue visible.
25. Probar recuperacion de contrasena.

No abras al publico hasta que esos puntos salgan bien.

## 15. Como se actualiza el codigo despues

Cada cambio futuro sigue este flujo:

1. Cambiamos codigo localmente.
2. Probamos local:

```bash
npm run lint
npm test
npm run build
```

3. Commit:

```bash
git add --all
git commit -m "Descripcion del cambio"
```

4. Subida:

```bash
git push
```

5. Render detecta el push a `main` y despliega automaticamente si Auto-Deploy
   esta activado.

## 16. Si algo falla

API no arranca:

- Revisa variables obligatorias.
- Revisa `DATABASE_URL`.
- Revisa logs de Render.
- Comprueba que `NODE_VERSION` sea `22.19.0`.
- Si el build dice que no encuentra `../uploads/uploads.service` o
  `../uploads/uploads.module`, confirma que estas usando el commit posterior a
  la correccion de `.gitignore`; ese error ocurria porque Git estaba ignorando
  por accidente el modulo de subidas de imagenes del backend.

Web no carga datos:

- Revisa `NEXT_PUBLIC_API_URL`.
- Revisa `CORS_ORIGIN`.
- Revisa que la API responda `/health`.

Login no se queda iniciado:

- Si usas URLs temporales Render, prueba `SESSION_COOKIE_SAME_SITE=none`.
- Si usas dominio propio, prueba `SESSION_COOKIE_SAME_SITE=lax`.
- Asegurate de que API y web usan HTTPS.

Pedidos pagados no cambian de estado:

- Revisa `STRIPE_WEBHOOK_SECRET`.
- Revisa que el webhook apunte a `/payments/webhook`.
- Revisa los eventos necesarios en Stripe.

No llegan correos:

- Revisa SMTP.
- Revisa que el remitente este verificado.
- Revisa spam.
- Revisa logs de API.

Fotos desaparecen:

- Revisa que la API tenga Persistent Disk.
- Revisa `UPLOAD_DIR=/opt/render/project/src/uploads`.

Admin perdio 2FA:

```bash
npm run admin:reset-2fa -- --email=admin@tudominio.es
```

Ejecutar solo desde Shell segura de Render.

## 17. Checklist final

- [ ] Render conectado con GitHub.
- [ ] PostgreSQL creado en Frankfurt.
- [ ] API creada en Frankfurt.
- [ ] Web creada en Frankfurt.
- [ ] API con disco persistente.
- [ ] API con `/health` OK.
- [ ] Web publica visible.
- [ ] Migraciones ejecutadas.
- [ ] Seed ejecutado.
- [ ] Admin entra.
- [ ] Admin activa 2FA.
- [ ] Cocina entra.
- [ ] SMTP envia correos.
- [ ] Stripe checkout abre.
- [ ] Stripe webhook confirma pago.
- [ ] Tracking funciona.
- [ ] Ticket muestra extras correctamente.
- [ ] Imagenes subidas sobreviven redeploy.
- [ ] Textos legales reales completados.
- [ ] Dominio propio configurado.
- [ ] Prueba real de compra terminada.

## Fuentes oficiales consultadas

- Render Web Services: https://render.com/docs/web-services
- Render Environment Variables and Secrets:
  https://render.com/docs/configure-environment-variables
- Render PostgreSQL: https://render.com/docs/postgresql-creating-connecting
- Render Persistent Disks: https://render.com/docs/disks
- Render Deploys and Pre-Deploy Command: https://render.com/docs/deploys
- Render Custom Domains: https://render.com/docs/custom-domains
- Render Node Version: https://render.com/docs/node-version
