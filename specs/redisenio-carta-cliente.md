# Redisenio carta cliente

## Contexto
- El cliente ve la carta en `apps/web/components/menu-client.tsx`, cargada desde `apps/web/app/page.tsx`.
- Los estilos globales de la carta, hero, promos, tarjetas y responsive viven en `apps/web/app/globals.css`.
- El carrito vive en `apps/web/components/cart-provider.tsx` y las paginas de compra en `apps/web/app/carrito/page.tsx` y `apps/web/app/checkout/page.tsx`.
- Los precios con descuento ya vienen calculados por backend y se renderizan con helpers de `apps/web/lib/product-pricing.ts` y `apps/web/lib/order-quote.ts`.
- La fase anterior de promos reales ya decidio que el frontend no calcula descuentos: solo muestra `price`, `promotionPricing`, dias validos y totales confirmados por backend.
- Existe una rama local `wip/rediseno-carta` con trabajo visual experimental; no se integra a `main` sin aprobacion escrita.
- La referencia visual aprobada es la maqueta generada para una carta mas gastronomica: hero limpio, promos visibles debajo, fotos con mas protagonismo y tarjetas mas faciles de leer.

## Objetivo
Redisenar visualmente la carta publica para que hero, promociones, categorias y tarjetas de producto se vean profesionales e intuitivas, manteniendo intacta la logica de promociones, precios, carrito y checkout.

## Flujo
SECUENCIA (orden temporal)
1. Cliente -> `/`: abre la carta publica.
2. Page -> API publica: carga settings, categorias, productos y promociones ya calculadas.
3. API publica -> Page: devuelve datos con precios base, descuentos aplicables, dias validos y estado de disponibilidad.
4. Page -> `MenuClient`: entrega los datos sin recalcular descuentos.
5. `MenuClient` -> Cliente: renderiza header, hero limpio, carrusel de promos, tabs de categorias y tarjetas.
6. Cliente -> Tabs de categoria: cambia entre Hamburguesas, Entrantes, Bebidas u otras categorias.
7. `MenuClient` -> Cliente: filtra visualmente productos por categoria sin cambiar precios.
8. Cliente -> Producto: abre ficha o pulsa agregar/configurar.
9. Producto/Carrito -> `CartProvider`: guarda item con precio y promo recibidos del backend.
10. Carrito/Checkout -> API `/orders/quote` o crear pedido: backend confirma total definitivo.
11. API -> Cliente: responde total real; UI solo lo muestra.

FLUJO (decisiones y casos borde)
```
cliente abre la carta
   |
   v
datos publicos cargan?
   | no
   v
mostrar estado de carga/error sin romper layout

   | si
   v
hay hero configurado?
   | no
   v
usar contenido fallback de marca

   | si
   v
mostrar hero visual limpio sin tarjeta flotante que tape portada
   |
   v
hay promociones activas visibles?
   | no
   v
ocultar carrusel y mantener carta normal

   | si
   v
mostrar carrusel debajo del hero con nombre, dias validos y producto
   |
   v
promo es valida hoy para descuento?
   | no
   v
mostrar promo como aviso con dias validos, sin fingir precio rebajado hoy

   | si
   v
mostrar precio original tachado y precio final ya calculado por backend
   |
   v
producto esta disponible?
   | no
   v
mostrar agotado o bloquear agregar, segun comportamiento actual

   | si
   v
permitir abrir ficha, extras/opciones y agregar al carrito
   |
   v
carrito cambia cantidad o elimina?
   |
   v
mantener totales segun datos backend/quote sin recalcular descuentos en frontend
   |
   v
checkout
```

FLUJO DE COMPATIBILIDAD VISUAL
```
renderizar pantalla
   |
   v
viewport desktop?
   | si -> layout amplio, hero + promos + grid de productos
   |
   no
   v
viewport movil?
   | si -> header compacto, hero legible, promos sin solapes, productos en una columna
   |
   v
imagen carga?
   | no -> fallback visual estable
   | si -> foto con protagonismo
   v
usuario prefiere movimiento reducido?
   | si -> sin autoplay ni animaciones continuas
   | no -> animaciones suaves permitidas
```

## Restricciones
- Todo el trabajo se hace en local hasta que el propietario autorice commit, push y despliegue.
- No tocar backend, Prisma, Stripe, checkout, calculo de descuentos ni contratos de API.
- El frontend no calcula descuentos; solo renderiza datos ya recibidos: precio base, precio final, nombre de promo y dias validos.
- No integrar la rama local `wip/rediseno-carta` a `main` sin aprobacion escrita.
- No usar contenido inventado de maquetas como contenido real.
- No agregar librerias nuevas para esta fase; usar Next/React actuales, CSS nativo, lucide-react y componentes existentes.
- Mantener `prefers-reduced-motion`: sin autoplay ni animaciones continuas cuando el usuario reduce movimiento.
- Cada tarea debe poder revisarse sola y no debe tocar mas de la pantalla indicada.

## Fuera de alcance
- Pantalla de cuenta del cliente.
- Redisenio del admin de menu/promos.
- Cambios en pagos, Stripe, cash, reportes o tickets.
- Nuevos campos de promo en base de datos.
- Cambio de paleta global desde admin.
- Migrar React/Next de version; esta fase usa el stack actual.

## Tareas
### T1: Preparar base segura de trabajo
- **Hacer:** confirmar estado git, crear o usar rama local de trabajo desde `main`, y dejar documentado que esta fase no mezcla cuenta/admin.
- **Archivos:** `specs/redisenio-carta-cliente.md`.
- **Verify:** `git status --short --branch` y confirmar que solo hay cambios esperados.

### T2: Hero publico sin tarjeta intrusiva
- **Hacer:** ajustar solo la composicion visual del hero para que la portada respire: texto legible, botones claros, datos de servicio ordenados y sin tarjeta de producto tapando la imagen principal.
- **Archivos:** `apps/web/components/menu-client.tsx`, `apps/web/app/globals.css`.
- **Verify:** capturas Playwright en desktop y movil de `/`; comprobar que no hay solapes ni overflow horizontal.

### T3: Carrusel de promociones visible y fiel a datos
- **Hacer:** colocar el carrusel/promos debajo del hero, visible cuando haya promos activas, mostrando nombre, dias validos y precio solo si backend lo trae como descuento aplicable. Mantener pausa hover/touch y `prefers-reduced-motion`.
- **Archivos:** `apps/web/components/menu-client.tsx`, `apps/web/app/globals.css`.
- **Verify:** con promo vigente se ve carrusel/banner; con promo inactiva o fuera de fecha no se ve; con promo fuera de dia valido se ve como aviso con dias validos sin precio rebajado falso.

### T4: Tarjetas de producto gastronomicas y claras
- **Hacer:** mejorar las tarjetas de producto para dar protagonismo a la foto, nombre, descripcion, disponibilidad, precio original/final y boton de agregar/configurar.
- **Archivos:** `apps/web/components/menu-client.tsx`, `apps/web/app/globals.css`.
- **Verify:** productos con foto, sin foto, agotados, con descuento y sin descuento se ven bien en desktop/movil.

### T5: Extras, ficha y carrito sin regresiones
- **Hacer:** revisar que abrir producto, elegir extras/opciones, agregar al carrito, quitar, cambiar cantidad y total sigan igual. Solo corregir estilos si hay solape visual.
- **Archivos:** `apps/web/components/product-detail-client.tsx`, `apps/web/components/cart-provider.tsx`, `apps/web/app/carrito/page.tsx`, `apps/web/app/globals.css`.
- **Verify:** flujo manual local: abrir producto con extras, agregar, cambiar cantidad, quitar y confirmar total. No cambiar logica.

### T6: Estados borde de carta
- **Hacer:** asegurar estados visuales limpios para carta vacia, producto no disponible, imagen rota/fallback, carga lenta/error y movil estrecho.
- **Archivos:** `apps/web/components/menu-client.tsx`, `apps/web/app/globals.css`.
- **Verify:** capturas desktop/movil de cada estado cuando sea posible; sin errores de consola.

### T7: Test Playwright de promo y carrito
- **Hacer:** agregar prueba e2e que proteja la regresion principal: promo vigente visible, dias validos visibles, precio original/final visible y carrito conserva precio descontado.
- **Archivos:** `e2e/promotion-pricing.spec.ts` o spec nueva bajo `e2e/`.
- **Verify:** ejecutar solo el test nuevo/actualizado y guardar resultado.

### T8: Verificacion final local
- **Hacer:** correr lint/build/tests necesarios y generar capturas finales desktop/movil de la carta.
- **Archivos:** sin cambios funcionales esperados.
- **Verify:** `npm.cmd run lint -w @mordida/web`, `npm.cmd run build -w @mordida/web`, test Playwright de promo en verde.

## Done (validacion final)
- [ ] Hero publico legible en desktop y movil, sin tarjeta de producto tapando portada.
- [ ] Carrusel de promos aparece con promo activa vigente y desaparece con promo inactiva/vencida.
- [ ] Promo fuera de dia valido se muestra solo como aviso, con dias validos visibles y sin precio rebajado falso.
- [ ] Productos con y sin descuento muestran precio correcto recibido del backend.
- [ ] Producto agotado/no disponible no permite compra accidental.
- [ ] Imagen rota usa fallback visual estable.
- [ ] Categorias/tabs funcionan: Hamburguesas, Entrantes, Bebidas y categorias futuras.
- [ ] Producto con extras/opciones se puede configurar y agregar.
- [ ] Carrito permite agregar, quitar, cambiar cantidad y mantiene totales correctos.
- [ ] Checkout sigue usando quote/backend sin cambios de logica.
- [ ] Sin overflow horizontal ni solapes en movil.
- [ ] `prefers-reduced-motion` desactiva autoplay/animaciones continuas.
- [ ] Test Playwright de promo/precio/carrito en verde.
- [ ] `npm.cmd run lint -w @mordida/web` en verde.
- [ ] `npm.cmd run build -w @mordida/web` en verde.
