# Mordida Tasty - Variables reales de produccion

Este archivo sirve para rellenar las variables reales cuando vayamos a desplegar.
No subas el `.env` real al repositorio. Usa el panel de secretos de Render, AWS,
Cloudflare o el proveedor elegido.

## Dominio y URLs

- `FRONTEND_URL`: URL publica de la web. Ejemplo: `https://www.mordidatasty.es`.
- `API_PUBLIC_URL`: URL publica de la API. Ejemplo: `https://api.mordidatasty.es`.
- `CORS_ORIGIN`: origenes permitidos para llamadas del navegador. Ejemplo:
  `https://www.mordidatasty.es,https://mordidatasty.es`.
- `NEXT_PUBLIC_API_URL`: URL publica de la API usada por Next.js. Importante:
  esta variable se necesita durante el build de la web porque queda incluida en
  el JavaScript del navegador.
- `NEXT_PUBLIC_GTM_ID`: ID del contenedor de Google Tag Manager. Tiene formato
  `GTM-XXXXXXX`. Si existe, la web carga GTM y no carga Analytics directo para
  evitar doble medicion.
- `NEXT_PUBLIC_GA_MEASUREMENT_ID`: ID de medicion de Google Analytics 4 para la
  web. Tiene formato `G-XXXXXXXXXX`. Se usa solo si `NEXT_PUBLIC_GTM_ID` esta
  vacio.

Recomendacion: usar dominio propio con web y API bajo el mismo dominio raiz:
`www.mordidatasty.es` y `api.mordidatasty.es`. Asi las cookies `httpOnly` son
mas fiables que usando dominios temporales distintos de proveedores.

## Analitica

Google Tag Manager o Google Analytics se cargan solo en la parte publica de la
web y solo cuando el usuario acepta la medicion en el banner de cookies. El panel
`/admin` queda fuera para no mezclar visitas internas del restaurante con
clientes reales.

En Render, agrega `NEXT_PUBLIC_GTM_ID` o `NEXT_PUBLIC_GA_MEASUREMENT_ID` en el
servicio web `mordida-tasty-web`, no en la API. Despues de guardarla, ejecuta un
nuevo deploy porque las variables `NEXT_PUBLIC_*` se integran en el build de
Next.js.

No configures a la vez una etiqueta GA4 directa y otra GA4 dentro de GTM con la
misma propiedad, porque contaria visitas duplicadas. La recomendacion actual es:
usar `NEXT_PUBLIC_GTM_ID` y administrar GA4 desde Google Tag Manager.

Para probar Tag Manager con el boton de Google, abre la web publica, acepta
"Aceptar medicion" en el banner de cookies y vuelve a ejecutar la prueba. Si no
aceptas medicion, el sitio no carga la etiqueta por privacidad.

## Contenido editable sin tocar codigo

Estos cambios se hacen desde `/admin/menu`, pestaña `Portada`, y se guardan en
la base de datos:

- Nombre visible, iniciales del logo, frase superior, titulo, texto y foto de
  portada.
- Producto destacado, texto sobre la carta, WhatsApp e Instagram.
- Ubicacion: titulo, texto, direccion visible, ciudad, codigo postal y enlace
  exacto de Google Maps.
- Apartado Nosotros: titulo y texto.

El campo `Enlace exacto Google Maps` tiene prioridad sobre la direccion escrita.
Usalo para evitar que Google envie al cliente a otro negocio con una direccion
parecida. La forma recomendada es abrir la ubicacion correcta en Google Maps,
usar `Compartir` -> `Copiar enlace`, pegar ese enlace en `/admin/menu` y guardar.
Si ese campo queda vacio, la web genera la ruta usando la direccion visible como
respaldo.

## Cabeceras de seguridad

La web aplica cabeceras defensivas desde `apps/web/next.config.ts`: HSTS en
produccion, ocultacion de `x-powered-by`, proteccion contra iframes externos,
`nosniff`, `Referrer-Policy`, `Permissions-Policy` y una CSP compatible con la
API, Google Analytics y Stripe.

No actives `preload` en `Strict-Transport-Security` hasta confirmar que el
dominio raiz y todos los subdominios que se vayan a usar funcionan siempre con
HTTPS. Una vez activado y enviado a listas de preload, revertirlo puede tardar.

## Base de datos

- `DATABASE_URL`: conexion PostgreSQL real. Debe usar un usuario con permisos
  sobre la base de datos de la aplicacion.

Antes de arrancar la API en produccion hay que ejecutar:

```bash
npm run prisma:deploy -w @mordida/api
```

Para el primer arranque, despues de migrar, se puede ejecutar:

```bash
npm run seed:prod -w @mordida/api
```

El seed de produccion crea usuarios y datos base si faltan, pero no pisa
contrasenas ni ajustes ya existentes.

## Auth y cookies

- `JWT_SECRET`: secreto largo, aleatorio y privado. Minimo 32 caracteres.
- `JWT_EXPIRES_IN`: duracion de sesion cliente. Valor actual recomendado: `7d`.
- `ADMIN_JWT_EXPIRES_IN`: duracion de sesion admin/cocina. Valor actual: `12h`.
- `SESSION_COOKIE_DOMAIN`: normalmente vacio. Usalo solo si necesitas compartir
  cookies entre subdominios, por ejemplo `.mordidatasty.es`.
- `SESSION_COOKIE_SAME_SITE`: `lax` si web y API estan en el mismo dominio raiz.
  Usa `none` solo si web y API quedan en dominios totalmente distintos; en ese
  caso tambien es obligatorio HTTPS.

## Stripe

- `STRIPE_SECRET_KEY`: clave live `sk_live_...`.
- `STRIPE_WEBHOOK_SECRET`: secreto del webhook `whsec_...`.
- `STRIPE_SUCCESS_PATH`: mantener
  `/seguimiento/{ORDER_NUMBER}?t={TRACKING_TOKEN}`.
- `STRIPE_CANCEL_PATH`: mantener `/checkout?cancelled=1`.

Webhook publico:

```text
https://api.tudominio.es/payments/webhook
```

Eventos necesarios:

- `checkout.session.completed`
- `checkout.session.expired`
- `payment_intent.payment_failed`

## SMTP

- `BREVO_API_KEY`: clave API de Brevo para enviar correo por HTTPS. En Render
  gratuito es la opcion recomendada porque no depende de puertos SMTP.
- `BREVO_API_URL`: mantener `https://api.brevo.com/v3/smtp/email` salvo que
  Brevo indique otro endpoint.
- `SMTP_HOST`: servidor SMTP real.
- `SMTP_PORT`: normalmente `587` con STARTTLS o `465` con SSL.
- `SMTP_SECURE`: `false` para 587, `true` para 465.
- `SMTP_USER`: usuario SMTP.
- `SMTP_PASSWORD`: clave SMTP.
- `SMTP_FROM`: remitente verificado. Ejemplo:
  `Mordida Tasty <no-reply@mordidatasty.es>`.
- `SMTP_TIMEOUT_MS`: tiempo maximo de espera para conectar/enviar correo.
  Valor recomendado: `10000`.

En produccion debes configurar `BREVO_API_KEY` o SMTP real. Sin uno de esos dos
metodos no se verifican correos ni recuperacion de contrasena.

## Imagenes y subidas

- `CLOUDINARY_CLOUD_NAME`: nombre de la nube de Cloudinary.
- `CLOUDINARY_API_KEY`: clave publica de API de Cloudinary.
- `CLOUDINARY_API_SECRET`: secreto de API de Cloudinary. Guardar solo como
  variable secreta en Render.
- `UPLOAD_DIR`: fallback local donde la API guarda fotos si Cloudinary no esta
  configurado. En produccion solo debe usarse con un disco persistente real.
- `UPLOAD_MAX_BYTES`: tamano maximo por imagen. Valor actual recomendado:
  `5242880` para 5 MB.

En Render gratis usa Cloudinary. El disco local de Render es efimero y las fotos
subidas al contenedor pueden perderse al reiniciar o redesplegar. Despues de
cambiar cualquiera de las variables `CLOUDINARY_*`, haz redeploy del servicio
`mordida-tasty-api`. La web tambien debe estar desplegada con soporte para
`https://res.cloudinary.com` en Next/Image y CSP.

Comportamiento de `/uploads`:

- En produccion con `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` y
  `CLOUDINARY_API_SECRET` completos, la API no sirve `/uploads`. Todas las
  subidas nuevas deben quedar en Cloudinary.
- En desarrollo local, `/uploads` sigue disponible como fallback aunque tengas
  Cloudinary configurado.
- En una produccion sin Cloudinary, `/uploads` solo debe usarse si `UPLOAD_DIR`
  apunta a un disco persistente real. No lo uses como almacenamiento principal
  en Render gratis.
- Si una imagen antigua aparece como `/uploads/...`, re-subela desde
  `/admin/menu` para generar una URL permanente de Cloudinary.
- Si cambias de cuenta Cloudinary, actualiza las tres variables `CLOUDINARY_*`
  en Render API y ejecuta un nuevo deploy. No hace falta tocar codigo.

## Seed inicial

- `MORDIDA_SEED_ADMIN_EMAIL`: email del administrador real.
- `MORDIDA_SEED_ADMIN_PASSWORD`: clave temporal larga para el primer acceso.
- `MORDIDA_SEED_KITCHEN_EMAIL`: email de cocina.
- `MORDIDA_SEED_KITCHEN_PASSWORD`: clave temporal larga para cocina.

Despues del primer acceso, activa 2FA en el admin y guarda los codigos en una
app autenticadora.

Si se pierde el dispositivo 2FA de un administrador, el reseteo no se hace desde
la web publica. Debe ejecutarlo alguien con acceso al servidor o consola del
proveedor:

```bash
npm run admin:reset-2fa -- --email=admin@tudominio.es
```

Luego ese administrador inicia sesion de nuevo y activa 2FA otra vez desde
`/admin/2fa`.
