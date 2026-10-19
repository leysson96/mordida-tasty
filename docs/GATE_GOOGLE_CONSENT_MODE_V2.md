# Gate de produccion - Google Consent Mode v2

Este Gate valida la web publica despues del despliegue. No se considera cerrado
hasta registrar el resultado y la evidencia de cada bloque. `/admin` debe quedar
fuera de toda medicion.

## Preparacion

- Confirmar en Render Web el commit desplegado.
- Confirmar en Render Web, sin copiar valores sensibles al informe:
  `NEXT_PUBLIC_GA_MEASUREMENT_ID`, `NEXT_PUBLIC_GOOGLE_ADS_ID` y
  `NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL`.
- Mantener `NEXT_PUBLIC_GTM_ID` vacio cuando se usa la integracion directa. Si
  se usa GTM como alternativa, evitar una segunda etiqueta GA4 para la misma
  propiedad.
- Abrir Chrome en una ventana de incognito sin extensiones de bloqueo.
- Abrir Tag Assistant en `https://tagassistant.google.com/` y conectar el
  dominio real.
- Tener disponibles GA4 DebugView, Google Ads Diagnostics y Stripe test.
- Preparar un producto disponible y anotar su precio final esperado.

## Evidencia requerida

Para cada caso guardar:

- fecha y hora de Espana;
- navegador y dispositivo;
- captura de la pantalla del cliente;
- captura de Consent y Summary en Tag Assistant;
- captura de DebugView o Diagnostics cuando corresponda;
- consola y red sin errores relacionados con Google;
- numero del pedido test solo en el registro privado del Gate.

No incluir nombres, correos, telefonos, direcciones, tracking tokens ni IDs
internos en capturas compartidas.

## Checklist

### 1. Visitante nuevo

1. Borrar cookies y almacenamiento del dominio o usar un perfil limpio.
2. Abrir la portada sin pulsar el banner.
3. En Tag Assistant abrir el primer evento Consent.

Resultado esperado:

- `analytics_storage`, `ad_storage`, `ad_user_data` y `ad_personalization`
  aparecen en `denied` antes de cualquier `config` o evento.
- Solo hay una Google tag.
- Se ve `Aceptar cookies`, `Solo necesarias` y `Configurar`.
- No existen cookies `_ga`, `_gcl_*` u otras cookies publicitarias de Google.

### 2. Solo necesarias

1. Pulsar `Solo necesarias`.
2. Navegar a otra pagina y recargar.

Resultado esperado:

- Tag Assistant muestra un `consent update` con los cuatro estados en `denied`.
- La eleccion persiste y el banner principal no reaparece.
- No se crean cookies de analitica o publicidad.
- Menu, carrito y checkout siguen funcionando.

### 3. Aceptar cookies

1. Restablecer las preferencias desde el acceso permanente.
2. Pulsar `Aceptar cookies`.
3. Navegar y recargar.

Resultado esperado:

- El `consent update` muestra los cuatro estados en `granted`.
- La preferencia persiste.
- GA4 Realtime o DebugView recibe `page_view` para la ruta publica.
- No aparece una segunda etiqueta o un segundo `page_view` para la misma carga.

### 4. Configuracion granular

Probar al menos estas combinaciones desde `Configurar`:

| Analitica | Medicion publicitaria | Personalizacion | Resultado esperado |
| --- | --- | --- | --- |
| Si | No | No | Solo `analytics_storage` granted |
| No | Si | No | `ad_storage` y `ad_user_data` granted |
| Si | Si | No | Todo granted salvo `ad_personalization` |

La personalizacion debe quedar deshabilitada cuando la medicion publicitaria
esta apagada.

### 5. Retirada posterior

1. Partir de `Aceptar cookies`.
2. Abrir el acceso permanente `Configurar cookies`.
3. Elegir `Solo necesarias`.

Resultado esperado:

- Se emite un nuevo `consent update` con los cuatro estados en `denied`.
- Los eventos posteriores respetan la retirada.
- La tienda no pierde carrito, sesion ni funciones necesarias.

### 6. Exclusion de admin

1. Abrir `/admin`, `/admin/menu` y `/admin/reportes`.
2. Revisar Tag Assistant, red y cookies.

Resultado esperado:

- No carga `gtag.js` ni GTM.
- No se envian `page_view`, `purchase` ni eventos de Google.
- No aparece el banner ni el acceso de preferencias en el panel.

### 7. Compra test

1. Aceptar todas las categorias.
2. Crear un pedido con tarjeta en Stripe test y completar el pago.
3. Mantener abierta la pagina de seguimiento hasta que el pedido muestre pago
   confirmado; recargar despues una vez.
4. Revisar `purchase` en Tag Assistant y GA4 DebugView.

Resultado esperado:

- No hay `purchase` mientras `paidAt` sea nulo.
- Tras el pago aparece exactamente un `purchase`, incluso con polling y recarga.
- `transaction_id` es el numero publico del pedido.
- `currency` es `EUR`; `value` coincide con el total final cobrado y `discount`
  con el descuento aplicado.
- El destino incluye GA4 y solo incluye `AW-ID/ETIQUETA` cuando
  `NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL` esta configurado.
- El payload no contiene nombre, correo, telefono, direccion, tracking token o
  ID interno.
- Google Ads Diagnostics reconoce la etiqueta y la accion de conversion. La
  aparicion en informes puede tardar y no sustituye la evidencia de Tag
  Assistant.

### 8. Seguridad, consola y movil

1. Repetir visitante nuevo, rechazo, aceptacion y compra en movil real o
   emulacion equivalente.
2. Revisar la cabecera `Content-Security-Policy` y la consola.

Resultado esperado:

- El banner y el dialogo no se solapan ni bloquean la compra.
- La CSP permite los destinos Google requeridos sin abrir origenes generales.
- No hay errores CSP, JavaScript ni solicitudes Google fallidas por codigo.

## Registro de cierre

| Bloque | Resultado | Evidencia | Observaciones |
| --- | --- | --- | --- |
| Visitante nuevo | Pendiente | | |
| Solo necesarias | Pendiente | | |
| Aceptar cookies | Pendiente | | |
| Configuracion granular | Pendiente | | |
| Retirada | Pendiente | | |
| Admin excluido | Pendiente | | |
| Compra GA4 | Pendiente | | |
| Compra Google Ads | Pendiente | | |
| CSP, consola y movil | Pendiente | | |

El Gate solo cambia a `APROBADO` cuando todos los bloques estan correctos. Si
uno falla, registrar la causa, corregir en local, repetir las pruebas automaticas
y desplegar un nuevo commit antes de reanudar el Gate.
