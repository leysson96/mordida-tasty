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
- `CHECKOUT_GRACE_MINUTES`: minutos de gracia para que un pedido ya creado
  pueda iniciar Stripe si la tienda cierra justo despues. Default: `15`.
- `DELIVERY_COVERAGE_MODE`: politica de cobertura de reparto. Valores:
  `zones` para aceptar solo codigos postales configurados; `global_fallback`
  para permitir reparto global con aviso visible en admin.

Recomendacion: usar dominio propio con web y API bajo el mismo dominio raiz:
`www.mordidatasty.es` y `api.mordidatasty.es`. Asi las cookies `httpOnly` son
mas fiables que usando dominios temporales distintos de proveedores.

Para `mordidatasty.es`, la API debe permitir todos los origenes reales que el
cliente pueda abrir en navegador. Si se usan raiz y `www`, mantener ambos en
`CORS_ORIGIN`, separados por coma. Despues de cambiar `CORS_ORIGIN`,
`FRONTEND_URL` o `API_PUBLIC_URL`, redeplegar la API. Despues de cambiar
`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_GTM_ID` o `NEXT_PUBLIC_GA_MEASUREMENT_ID`,
usar `Save, rebuild, and deploy` en la web porque Next.js los integra en el
build.

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

Si manana quieres cambiar Analytics o Tag Manager no hay que tocar codigo:
cambia `NEXT_PUBLIC_GTM_ID` o `NEXT_PUBLIC_GA_MEASUREMENT_ID` en Render Web y
redepliega la web. Si usas GTM, los cambios de etiquetas se administran dentro
de Google Tag Manager y luego se publican como una nueva version del contenedor.

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

Para corregir una ruta equivocada de Google Maps:

1. Abre Google Maps en el punto exacto del local.
2. Pulsa `Compartir`.
3. Copia el enlace publico.
4. Entra a `/admin/menu`, pestana `Portada`.
5. Pega el enlace en `Enlace exacto Google Maps`.
6. Guarda portada y prueba el boton `Como llegar` desde movil.

No dependas solo del texto de la direccion cuando Google confunde el numero, la
mano o un negocio cercano.

## Zonas, delivery y efectivo

Las zonas de delivery se administran desde el panel admin. En produccion, el
modo recomendado para abrir al publico es:

```text
DELIVERY_COVERAGE_MODE=zones
```

Con `zones`, si no hay zonas activas, la API rechaza delivery y el admin muestra
un aviso. Esto evita aceptar pedidos fuera de cobertura por accidente.

Usa `global_fallback` solo de forma consciente y temporal, por ejemplo si el
restaurante decide aceptar todo el reparto manualmente mientras termina de
cargar zonas. Despues de cambiar `DELIVERY_COVERAGE_MODE`, redeplegar la API y
probar un codigo postal permitido y otro fuera de zona.

El pago en efectivo funciona asi:

- El cliente puede elegir efectivo en recogida o delivery.
- En delivery, el cliente debe indicar con cuanto paga para calcular el cambio.
- El pedido efectivo nace operativo, pero el pago queda pendiente de caja hasta
  marcar `Efectivo cobrado` desde admin.
- Los reportes separan ingresos cobrados de efectivo pendiente para no inflar
  caja.

Despues de tocar cualquier flujo de efectivo, probar: pedido efectivo recogida,
pedido efectivo delivery con cambio, boton `Efectivo cobrado`, ticket impreso y
reportes.

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

`CHECKOUT_GRACE_MINUTES` controla la ventana de gracia de Stripe. Si la tienda
cierra despues de crear un pedido, ese pedido puede iniciar Stripe dentro de esa
ventana. Fuera de la ventana, el checkout se rechaza y el pedido queda expirado
cuando corresponde. No uses valores menores de 1 ni mayores de 120.

Cuando cambies claves Stripe o webhook:

1. Cambia `STRIPE_SECRET_KEY` o `STRIPE_WEBHOOK_SECRET` en Render API.
2. Redepliega la API.
3. Haz un pago de prueba con Stripe test.
4. Confirma en Stripe Dashboard que el webhook responde `2xx`.
5. Confirma en admin que el pedido queda pagado/confirmado.

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

## Tabla rapida de cambios operativos

| Cambio | Donde se cambia | Requiere deploy | Prueba obligatoria |
| --- | --- | --- | --- |
| GTM/GA | Render Web o Google Tag Manager | Si cambia `NEXT_PUBLIC_*`, rebuild web | Aceptar cookies y probar Tag Assistant |
| URL API de la web | `NEXT_PUBLIC_API_URL` en Render Web | Rebuild web | Home carga menu y checkout consulta delivery |
| CORS/origen web | `CORS_ORIGIN` en Render API | Redeploy API | Registro, login, admin y checkout desde dominio real |
| URL publica web/API | `FRONTEND_URL`, `API_PUBLIC_URL` en Render API | Redeploy API | Correos, Stripe success URL y cookies |
| Google Maps | `/admin/menu` -> `Portada` | No | Boton `Como llegar` abre el punto correcto |
| Portada/Nosotros | `/admin/menu` -> `Portada` | No | Home muestra textos e imagen sin romper mobile |
| Cloudinary | `CLOUDINARY_*` en Render API | Redeploy API | Subir imagen, reiniciar API y comprobar que persiste |
| Stripe | `STRIPE_*` en Render API y Dashboard Stripe | Redeploy API | Pago test y webhook `2xx` |
| Brevo/correo | `BREVO_*` o SMTP en Render API | Redeploy API | Registro, verificacion y recuperar contrasena |
| Zonas delivery | Admin y `DELIVERY_COVERAGE_MODE` si aplica | Solo si cambia variable | Codigo permitido y codigo fuera de zona |
| Efectivo | Flujo admin/caja | No si es operacion diaria | Marcar cobrado y revisar ticket/reportes |
| Ventana checkout | `CHECKOUT_GRACE_MINUTES` en Render API | Redeploy API | Pedido dentro/fuera de ventana de gracia |
