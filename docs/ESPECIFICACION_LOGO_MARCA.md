# Logo de marca administrable

## Objetivo

Sustituir el distintivo temporal `MT` por el logo real configurado desde
`Admin > Menu > Portada y marca` en:

- cabecera publica y cabecera administrativa;
- pestanas y favoritos del navegador;
- accesos directos instalados desde la web;
- resultados organicos de buscadores;
- vistas previas al compartir enlaces y datos estructurados.

La configuracion de Google Ads queda fuera de este desarrollo y se gestiona
directamente en Google Ads.

## Fuente de verdad

Los logos definitivos no se guardan en Git ni se incluyen en un despliegue.
Un administrador los carga desde la web y la API los almacena con el sistema ya
existente: Cloudinary en produccion y almacenamiento local en desarrollo.

La configuracion publica mantiene dos campos independientes:

- `brandSquareLogoUrl`: icono cuadrado para favicon, buscadores y dispositivos;
- `brandHeaderLogoUrl`: logo horizontal para las cabeceras.

Los campos antiguos `logoMode` y `logoImageUrl` se conservan internamente para
compatibilidad durante la transicion. Ya no se muestran como opciones del
formulario.

## Archivos requeridos

### Logo cuadrado

- Formato de carga: PNG.
- Proporcion obligatoria: `1:1`.
- Medida recomendada: `1200 x 1200 px`.
- Medida minima aceptada: `512 x 512 px`.
- Medida maxima aceptada: `4096 x 4096 px`.
- Peso maximo: `5 MB`.
- Fondo transparente si la identidad de marca lo permite.
- Margen de seguridad recomendado: entre 10 % y 15 % por lado.

El original editable puede conservarse como SVG fuera del sistema. El admin no
acepta SVG porque puede contener contenido activo y exige una sanitizacion mas
compleja. El PNG reduce superficie de ataque y funciona en todos los destinos.

### Logo horizontal

- Formato de carga: PNG.
- Proporcion obligatoria: entre `3:1` y `4:1`.
- Medidas recomendadas: `1200 x 400 px` o `1600 x 400 px`.
- Anchura aceptada: entre `1200` y `4096 px`.
- Altura aceptada: entre `300` y `1366 px`.
- Peso maximo: `5 MB`.
- Fondo transparente y margen de seguridad minimo del 5 %.

La cabecera siempre utiliza `object-fit: contain`; el logo no se recorta ni se
deforma.

## Implementacion

1. El formulario ofrece dos selectores y una vista previa para cada logo.
2. Cada imagen se puede reemplazar o retirar de forma independiente.
3. La API exige sesion administrativa, 2FA y rol ADMIN.
4. La API comprueba MIME, firma PNG, peso, dimensiones y proporcion con
   `sharp 0.35.5` antes de almacenar el archivo.
5. La carga y el cambio de configuracion quedan en la auditoria administrativa.
6. La cabecera prefiere el logo horizontal; si no existe, usa el cuadrado junto
   al nombre; si tampoco existe, muestra solo el nombre y nunca las iniciales.
7. `/brand-icon.png` entrega el logo cuadrado configurado desde una URL estable.
8. El manifiesto, Apple icon, Open Graph y JSON-LD apuntan a esa ruta estable.
9. Un cambio desde el admin se refleja sin modificar codigo ni desplegar.

## Compatibilidad y fallo seguro

- Una configuracion antigua con modo `ICON` migra visualmente al logo cuadrado.
- Una configuracion antigua con modo `LOGO` migra visualmente al horizontal.
- Si falla el logo horizontal, la cabecera intenta el cuadrado.
- Si no existe una imagen valida, se muestra el nombre del negocio.
- La ruta del favicon solo descarga PNG desde Cloudinary o desde `/uploads` de
  la propia API; no acepta URLs arbitrarias.

## Verificacion previa al despliegue

1. Subir un PNG cuadrado valido y comprobar su vista previa.
2. Subir un PNG horizontal valido y comprobar que no se recorta.
3. Comprobar cabecera publica y admin en escritorio, tablet y movil.
4. Comprobar `/brand-icon.png` con HTTP 200 y `Content-Type: image/png`.
5. Comprobar `/manifest.webmanifest` y los metadatos de la portada.
6. Intentar PNG con proporcion incorrecta, archivo renombrado y archivo mayor
   de 5 MB; todos deben ser rechazados.
7. Retirar cada logo por separado y verificar los fallbacks.
8. Ejecutar lint, tests y build del monorepo.
9. Confirmar que ningun archivo real de marca aparece en `git status`.

## Resultado esperado en buscadores

El sitio publica una URL estable y valida para el favicon. Los buscadores pueden
tardar varios dias o semanas en volver a rastrear y actualizar el icono; el
cambio no es instantaneo ni puede forzarse desde la aplicacion. Despues del
despliegue se puede solicitar la reindexacion de la portada en Search Console.
