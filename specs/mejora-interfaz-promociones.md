# Promociones y mejora visual del menu

## Contexto
- El frontend vive en `apps/web` con Next.js, React y CSS global en `apps/web/app/globals.css`.
- El admin de menu ya existe en `apps/web/components/admin-menu-client.tsx` con secciones de productos, categorias y portada.
- La pagina cliente del menu ya existe en `apps/web/components/menu-client.tsx`.
- La configuracion publica se guarda en `Setting` como JSON mediante `SettingsService`.
- Los endpoints de `/admin` ya estan protegidos con `JwtAuthGuard`, `AdminTwoFactorGuard`, `RolesGuard` y `@Roles(Role.ADMIN)`.
- La paleta de marca se mantiene centralizada en los tokens CSS de `globals.css`.

## Objetivo
Agregar una promocion visual administrable y mejorar el protagonismo de las fotos de producto sin tocar checkout, Stripe, calculos de precio ni descuentos reales.

## Flujo
SECUENCIA (orden temporal)
1. Admin -> /admin/menu: abre la seccion Promociones.
2. Web admin -> API: carga productos, categorias y settings.
3. Admin -> Web admin: configura promocion visual.
4. Web admin -> API /admin/settings/promotion: guarda la configuracion.
5. API -> SettingsService: normaliza y valida datos.
6. SettingsService -> DB Setting: guarda promotion_campaign.
7. Cliente -> mordidatasty.es: abre la carta.
8. Web cliente -> API: carga menu y settings publicos.
9. Web cliente: comprueba promocion activa, fechas Europe/Madrid y producto disponible.
10. Web cliente -> Cliente: muestra promo o la oculta sin romper el menu.

FLUJO (decisiones)
```
entrada cliente
   |
   v
hay promotion_campaign?
   | no
   v
menu normal

   | si
   v
enabled === true?
   | no
   v
menu normal

   | si
   v
fecha actual Europe/Madrid dentro de YYYY-MM-DD?
   | no
   v
menu normal

   | si
   v
producto existe y esta disponible?
   | no
   v
menu normal

   | si
   v
mostrar promocion visual
```

## Restricciones
- No tocar calculo de precios, Stripe, checkout, pagos, fidelidad ni pedidos.
- No agregar dependencias nuevas salvo justificacion posterior.
- La promocion nace desactivada/vacia por defecto a nivel persistente.
- No usar contenido de maqueta como contenido real de produccion.
- Las fechas son `YYYY-MM-DD` y se evalua el dia actual en `Europe/Madrid`.
- Si la promocion esta incompleta o apunta a un producto no disponible, el cliente ve el menu normal.
- Solo rol ADMIN puede guardar la promocion, igual que el resto de `/admin/menu`.

## Fuera de alcance
- Descuentos reales en checkout.
- Cupones, codigos promocionales o productos gratis.
- Programacion por horas exactas.
- Editor visual de paleta desde admin.
- Migracion a otra libreria de UI.

## Tareas
### T1: Configuracion backend de promocion visual
- **Hacer:** agregar tipo, normalizacion, default inactivo, endpoint admin y respuesta publica.
- **Archivos:** `apps/api/src/settings/settings.service.ts`, `apps/api/src/settings/settings.controller.ts`, `apps/api/src/admin/admin.controller.ts`, `apps/api/src/admin/dto/settings.dto.ts`.
- **Verify:** `npm.cmd run test -w @mordida/api -- settings.service.spec.ts`.

### T2: Tipos web y admin Promociones
- **Hacer:** agregar tipos web, cargar/guardar promotion desde admin y nueva pestana Promociones en `/admin/menu`.
- **Archivos:** `apps/web/lib/types.ts`, `apps/web/components/admin-menu-client.tsx`.
- **Verify:** `npm.cmd run lint -w @mordida/web`.

### T3: Promo cliente y mejora visual
- **Hacer:** mostrar bloque promocional solo cuando sea valido, mejorar tarjetas de producto y animaciones CSS ligeras.
- **Archivos:** `apps/web/components/menu-client.tsx`, `apps/web/app/globals.css`.
- **Verify:** `npm.cmd run build -w @mordida/web`.

### T4: Documentacion de marca
- **Hacer:** documentar paleta, variables principales y donde se cambia cada cosa.
- **Archivos:** `docs/INTERFAZ_Y_MARCA.md`.
- **Verify:** lectura manual del documento.

### V-promos-visual-polish: Acabado visual del bloque destacado
- **Hacer:** aplicar flotacion suave a la imagen, sombra sincronizada, insignia superpuesta con datos reales y titular con tramo final en color de acento.
- **Archivos:** `apps/web/components/menu-client.tsx`, `apps/web/app/globals.css`.
- **Verify:** `npm.cmd run lint -w @mordida/web` y `npm.cmd run build -w @mordida/web`.
- **Manual:** revisar desktop y movil con Playwright, sin solapes, sin warning de preload y respetando `prefers-reduced-motion`.

## Done (validacion final)
- [ ] `npm.cmd run test -w @mordida/api -- settings.service.spec.ts`
- [ ] `npm.cmd run lint -w @mordida/api`
- [ ] `npm.cmd run lint -w @mordida/web`
- [ ] `npm.cmd run build -w @mordida/api`
- [ ] `npm.cmd run build -w @mordida/web`
- [ ] Manual: admin guarda promocion desactivada y no aparece en cliente.
- [ ] Manual: admin activa promocion valida y aparece antes del menu.
- [ ] Manual: producto agotado/inexistente oculta promocion.
- [ ] Manual: vista movil sin solapes ni errores de consola.
- [ ] Manual: promo destacada flota suavemente y no genera layout shift.
