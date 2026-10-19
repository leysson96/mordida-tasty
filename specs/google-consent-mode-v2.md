# Google Consent Mode v2

## Contexto
- La web publica usa Next.js 16, React 19 y `gtag.js` desde
  `apps/web/components/google-analytics.tsx`.
- GA4 usa `NEXT_PUBLIC_GA_MEASUREMENT_ID` y Google Ads usa
  `NEXT_PUBLIC_GOOGLE_ADS_ID`; ambos destinos comparten una sola etiqueta de
  Google para evitar eventos duplicados.
- El consentimiento actual se guarda en `localStorage` con la clave
  `mordida_cookie_consent` y solo distingue `technical` y `analytics`.
- Hoy la etiqueta no se carga hasta aceptar analitica. La siguiente fase
  adoptara Consent Mode v2 avanzado: la etiqueta podra emitir senales sin
  cookies con consentimiento denegado y Google podra modelar resultados cuando
  alcance sus umbrales, sin convertir el rechazo en un consentimiento falso.
- Los valores por defecto de `analytics_storage`, `ad_storage`, `ad_user_data`
  y `ad_personalization` seran `denied` y se estableceran antes de configurar
  GA4 o Ads.
- Una preferencia antigua `analytics` solo concedera analitica. No concedera
  publicidad ni personalizacion de forma retroactiva.
- `/admin` permanecera fuera de la medicion para no mezclar actividad interna
  del restaurante con clientes reales.
- No se enviaran a Google nombres, correos, telefonos, direcciones, numeros de
  pedido ni otros datos personales del cliente.
- Herramientas: React/Next.js y `next/script` para ordenar la carga; API
  `gtag('consent', ...)` para Consent Mode v2; CSP de Next para limitar destinos;
  Playwright para comprobar consentimiento y eventos en escritorio/movil; Google
  Tag Assistant, GA4 DebugView y Google Ads Diagnostics para el Gate de
  produccion.
- No se anadira una dependencia de CMP en esta primera implementacion. Se
  conservara el banner propio y se hara compatible con Consent Mode v2.
- El boton principal del banner se llamara exactamente `Aceptar cookies`. No se
  usara el texto `Aceptar medicion`. Las alternativas visibles seran
  `Solo necesarias` y `Configurar`.

## Objetivo
Medir trafico, origen de campanas y conversiones con GA4 y Google Ads mediante
Consent Mode v2 avanzado, respetando una eleccion real y granular del cliente y
sin contaminar datos con actividad del panel administrativo.

## Flujo

```text
SECUENCIA (orden temporal abajo)
1. Cliente -> Web publica: abre cualquier pagina no administrativa.
2. Web -> dataLayer: inicializa gtag y establece Consent Mode v2 antes de las
   etiquetas.
3. Web -> Preferencia local: lee la eleccion versionada guardada anteriormente.
4. Web -> Google tag: carga una sola etiqueta con GA4 y Google Ads.
5. Sin eleccion previa -> Google tag: mantiene analytics, ads, datos de anuncios
   y personalizacion en denied; solo permite senales sin cookies.
6. Web -> Cliente: muestra Aceptar cookies, Solo necesarias y Configurar.
7. Cliente -> Banner: elige una opcion general o categorias granulares.
8. Banner -> Preferencia local: guarda la eleccion versionada.
9. Banner -> Google tag: ejecuta consent update antes de enviar nuevos eventos.
10. Web -> GA4: envia page_view y eventos permitidos por la eleccion.
11. Pago confirmado -> Google tag: envia purchase a GA4 y, si existe una accion
    de conversion configurada, a Google Ads una sola vez.
12. Google -> Analytics/Ads: presenta datos observados y, cuando sea elegible,
    conversiones modeladas para cubrir parte del trafico sin consentimiento.
13. Administrador -> Preferencias: el cliente puede cambiar o retirar su
    eleccion y los eventos posteriores respetan el nuevo estado.
```

```text
Cliente abre pagina
    |
    v
Es ruta /admin?
    | si ------------------------------> No cargar ni medir
    |
    no
    v
Existe preferencia versionada?
    | no ------------------------------> Todo denied + senal sin cookies
    |                                      + mostrar banner
    |
    si
    v
Es preferencia antigua `analytics`?
    | si ------------------------------> Analytics granted; Ads y
    |                                      personalizacion denied
    |
    no
    v
Aplicar categorias guardadas
    |
    v
Cliente elige Solo necesarias?
    | si ------------------------------> Todo denied; sin cookies ni perfiles
    |
    no
    v
Cliente acepta Analitica?
    | si ------------------------------> analytics_storage granted
    |
    no --------------------------------> analytics_storage denied
    |
    v
Cliente acepta Medicion publicitaria?
    | si ------------------------------> ad_storage y ad_user_data granted
    |
    no --------------------------------> ambos denied
    |
    v
Cliente acepta Personalizacion?
    | si ------------------------------> ad_personalization granted
    |
    no --------------------------------> ad_personalization denied
    |
    v
Se confirma un pago y hay conversion label?
    | no ------------------------------> No enviar conversion de compra a Ads
    |
    si
    v
Ya se envio esa conversion en este navegador?
    | si ------------------------------> No duplicar
    |
    no
    v
Enviar purchase sin datos personales y registrar evidencia de prueba
```

## Restricciones
- El boton principal debe mostrar exactamente `Aceptar cookies`; las opciones
  `Solo necesarias` y `Configurar` deben ser visibles y faciles de usar.
- Rechazar debe ser una eleccion real. No se usaran textos enganosos, opciones
  premarcadas, fingerprinting ni identificadores alternativos para eludirla.
- El estado inicial sera `denied` para `analytics_storage`, `ad_storage`,
  `ad_user_data` y `ad_personalization` antes de ejecutar cualquier `config` o
  evento de Google.
- No enviar PII: nombre, correo, telefono, direccion, tracking token o ID interno
  de base de datos.
- El numero publico de pedido solo podra usarse como `transaction_id` de una
  compra confirmada para deduplicacion, nunca como dimension de usuario.
- No duplicar `gtag.js`, GA4 ni Google Ads entre la integracion directa y GTM.
- No medir rutas `/admin`, ni tocar autenticacion, precios, promociones, pagos,
  estados de pedido, Prisma o contratos de API.
- Los IDs se leeran de variables `NEXT_PUBLIC_*`; no se codificaran IDs reales
  dentro de componentes ni tests.
- Sin nuevas dependencias salvo que aparezca una necesidad demostrable durante
  la implementacion.
- Todo se implementara y probara en local. No habra nuevo push ni despliegue sin
  autorizacion explicita del propietario.

## Fuera de alcance
- Ocultar la medicion al cliente o medirlo individualmente despues de rechazar.
- Google Tag Manager server-side, proxy propio de analitica o una CMP externa.
- Remarketing, audiencias personalizadas, Customer Match y Enhanced
  Conversions con datos del cliente.
- Crear o modificar campanas, presupuestos o acciones de conversion dentro de
  Google Ads.
- Recuperar historico anterior a la implantacion o garantizar modelado cuando
  Google no alcance sus umbrales de volumen.

## Tareas

### T1: Modelar consentimiento versionado
- **Hacer:** sustituir el valor simple por una preferencia versionada y tipada
  para analitica, medicion publicitaria y personalizacion; mantener lectura
  compatible de `technical` y `analytics`; exponer helpers puros para convertir
  la preferencia a los cuatro estados de Consent Mode v2.
- **Archivos:** `apps/web/lib/cookie-consent.ts`,
  `apps/web/components/google-consent-defaults.tsx`, `apps/web/app/layout.tsx`.
- **Verify:** lint web y prueba automatizada que demuestre que un usuario nuevo
  empieza con los cuatro estados en `denied`, y que el valor antiguo
  `analytics` no concede publicidad.

### T2: Activar Consent Mode v2 avanzado
- **Hacer:** inicializar `dataLayer` y el estado de consentimiento antes de la
  etiqueta; cargar una sola instancia de `gtag.js` en rutas publicas incluso con
  consentimiento denegado; configurar GA4 y Ads despues del estado por defecto;
  aplicar `consent update` cuando cambie la preferencia y mantener `/admin`
  excluido.
- **Archivos:** `apps/web/components/google-analytics.tsx`,
  `apps/web/components/google-consent-defaults.tsx`.
- **Verify:** Playwright intercepta Google y comprueba el orden `consent
  default -> config -> consent update`, la ausencia en `/admin` y que no hay dos
  scripts de Google.

### T3: Crear banner y preferencias granulares
- **Hacer:** mostrar `Aceptar cookies`, `Solo necesarias` y `Configurar`; crear
  un dialogo accesible con controles separados para Analitica, Medicion
  publicitaria y Personalizacion; guardar, cambiar y retirar la eleccion sin
  recargar la pagina; incluir un acceso permanente para revisar preferencias.
- **Archivos:** `apps/web/components/cookie-banner.tsx`,
  `apps/web/app/globals.css`, `apps/web/app/privacidad/page.tsx`.
- **Verify:** Playwright en escritorio y movil prueba las tres acciones,
  navegacion por teclado, foco del dialogo, persistencia tras recargar y retirada
  posterior del consentimiento.

### T4: Medir compras sin duplicados
- **Hacer:** crear un helper tipado para eventos Google; emitir `purchase` solo
  cuando el seguimiento devuelve `paidAt`, con `transaction_id`, moneda EUR,
  valor final y descuento; usar el mismo evento para GA4 y el destino Ads solo
  cuando exista `NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL`; impedir repeticion en
  recargas y polling.
- **Archivos:** `apps/web/lib/google-events.ts`,
  `apps/web/components/tracking-client.tsx`, `.env.example`.
- **Verify:** Playwright simula pedido pendiente y pagado, confirma cero eventos
  antes del pago y exactamente un `purchase` despues, incluso tras polling y
  recarga; el payload no contiene datos personales.

### T5: Blindar la integracion con Playwright
- **Hacer:** ampliar la suite para visitante nuevo, rechazo, aceptacion completa,
  configuracion granular, preferencia antigua, retirada, ruta admin, CSP,
  pagina vista y compra deduplicada; ejecutar cada caso en escritorio y movil.
- **Archivos:** `e2e/google-tag.spec.ts`, `e2e/mordida-fixtures.ts`,
  `e2e/run-e2e.mjs`.
- **Verify:** `npm.cmd run test:e2e -- e2e/google-tag.spec.ts` termina sin fallos
  en los proyectos desktop y mobile.

### T6: Documentar y ejecutar el Gate
- **Hacer:** documentar variables, categorias y significado de cada opcion;
  registrar como obtener el conversion label sin incluir secretos; preparar el
  checklist de Tag Assistant, GA4 DebugView y Google Ads Diagnostics para
  aceptar, rechazar y compra test.
- **Archivos:** `docs/VARIABLES_PRODUCCION.md`,
  `docs/GATE_GOOGLE_CONSENT_MODE_V2.md`.
- **Verify:** un desarrollador puede configurar un entorno limpio siguiendo la
  documentacion; el Gate contiene resultado esperado y evidencia requerida para
  cada estado de consentimiento.

## Done (validacion final)
- [ ] `npm.cmd run lint -w @mordida/web` pasa.
- [ ] `npm.cmd run build -w @mordida/web` pasa.
- [ ] La suite E2E de Google pasa completa en escritorio y movil.
- [ ] Usuario nuevo: Google recibe estados `denied` antes de cualquier config.
- [ ] `Aceptar cookies`: concede las categorias y persiste la eleccion.
- [ ] `Solo necesarias`: no crea cookies de analitica o publicidad y mantiene
  las categorias denegadas.
- [ ] `Configurar`: cada categoria controla solo sus señales correspondientes.
- [ ] Preferencia antigua `analytics`: concede analitica, pero no publicidad ni
  personalizacion.
- [ ] `/admin`: no carga etiqueta ni envia eventos Google.
- [ ] Compra Stripe test: GA4 recibe un solo `purchase` con importe correcto.
- [ ] Google Ads solo recibe compra si existe un conversion label valido.
- [ ] Ningun payload contiene nombre, correo, telefono, direccion o token.
- [ ] CSP y consola quedan sin errores de Google Analytics/Ads.
- [ ] Gate de produccion aprobado antes de anunciar la medicion como terminada.
