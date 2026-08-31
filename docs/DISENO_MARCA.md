# Mordida Tasty - Guia de diseno y marca

## Donde cambiar la identidad

- Nombre de la pagina, iniciales del logo, textos de portada, foto de portada,
  producto destacado, texto sobre la carta, WhatsApp, Instagram y fuente principal:
  panel admin en `/admin/menu`, bloque `Portada y marca`.
- Colores, radios, sombras y ancho de pagina:
  `apps/web/app/globals.css`, bloque inicial `Design tokens`.
- Icono/favico de la web:
  `apps/web/app/icon.svg`.
- Valores de emergencia si la API no responde:
  `apps/web/lib/brand.ts`.

## Como cambiar colores sin romper la app

Edita solo variables CSS del bloque `:root`:

- `--color-brand`: color principal de botones y llamadas a la accion.
- `--color-brand-dark`: hover y contraste del color principal.
- `--color-ink`: texto fuerte y fondos internos oscuros.
- `--color-paper`: fondo general.
- `--color-surface`: superficies claras.
- `--color-green`, `--color-gold`, `--color-blue`, `--color-danger`: estados
  operativos para abierto, avisos, pedidos y errores.

## Como cambiar la fuente

Desde `/admin/menu`, campo `Fuente principal`.
Usa un valor CSS valido, por ejemplo:
`Inter, Arial, sans-serif`.

El fallback tecnico sigue en `--font-sans` dentro de
`apps/web/app/globals.css`.

## Imagenes del menu y portada

- Portada: `/admin/menu`, bloque `Portada y marca`, campo `Foto portada`.
- Nuevo producto: `/admin/menu`, bloque `Nuevo producto`, campo `Imagen`.
- Producto existente: `/admin/menu`, fila del producto, campo `Imagen`.

Solo se aceptan imagenes `JPG`, `PNG` o `WEBP`. La API las guarda en
`UPLOAD_DIR` y devuelve una URL publica bajo `/uploads`.

## Criterio visual actual

- Home con banner de venta usando producto real.
- Menu visible justo despues del hero.
- Botones primarios rojos, fondo calido y contraste oscuro.
- Admin/cocina con estilo mas operativo: lectura rapida, columnas y estados.
- Portada y catalogo editables sin tocar codigo.
- WhatsApp e Instagram visibles en la portada solo si se configuran desde admin.
- Sin cambiar la logica de pedidos, pagos, cookies ni roles.
