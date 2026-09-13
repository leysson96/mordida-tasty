# Interfaz y marca

## Paleta actual
La paleta global de Mordida Tasty esta centralizada en:

`apps/web/app/globals.css`

Dentro del bloque `:root` estan los tokens principales:

```css
--color-brand: #5a070b;
--color-brand-dark: #350305;
--color-accent: #bd5a08;
--color-accent-dark: #883c05;
--color-paper: #fff5e9;
--color-surface: #fffaf4;
--color-line: #ead8c3;
--color-green: #23715a;
--color-gold: #e08a28;
```

Para cambiar la identidad visual completa se deben modificar esos tokens, no colores sueltos repartidos por componentes.

## Contenido editable desde admin
El contenido comercial que no deberia requerir despliegue se edita desde:

`/admin/menu`

Secciones:

- `Productos`: carta, imagenes, precios, disponibilidad y extras.
- `Categorias`: orden y visibilidad de categorias.
- `Portada`: nombre, hero, ubicacion, Google Maps, WhatsApp, Instagram y nosotros.
- `Promos`: promocion visual activa/inactiva.

## Promociones
Las promociones actuales son visuales. Sirven para destacar un producto y llevar al cliente al flujo normal de producto/carrito.

No modifican:

- precios del producto
- descuentos del pedido
- total del checkout
- Stripe
- pagos en efectivo

Si una promocion debe aplicar un descuento real, se debe crear otra fase con validacion en backend y pruebas de pago.

## Fechas de promociones
Las promociones usan fechas simples `YYYY-MM-DD`.

La web evalua si la promocion esta activa usando la zona horaria `Europe/Madrid`, desde las 00:00 hasta las 23:59 del dia configurado.

## Reglas de seguridad visual
La promocion no aparece en cliente si:

- esta desactivada
- no tiene producto asociado
- el producto no existe
- el producto esta agotado
- falta titulo, texto, etiqueta o boton
- la fecha actual esta fuera del rango

Esto evita que se publique contenido incompleto o de maqueta por error.
