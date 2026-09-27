# Redisenio operativo del menu admin

## Contexto
- La pantalla actual vive principalmente en `apps/web/components/admin-menu-client.tsx`.
- Ese componente concentra productos, categorias, portada, promociones visuales, promociones con descuento, subida de imagenes, filtros, formularios y acciones de disponibilidad.
- El stack actual de interfaz es Next.js, React, CSS global propio en `apps/web/app/globals.css`, `lucide-react` para iconos y `recharts` para graficas.
- No hay Tailwind, Bootstrap ni shadcn/ui instalado actualmente.
- El objetivo no es cambiar la identidad visual de Mordida Tasty, sino convertir `/admin/menu` en una herramienta operativa mas clara, segura e intuitiva.
- Todo este trabajo se hara primero en local. No hay push a GitHub ni produccion hasta autorizacion explicita del propietario.

## Objetivo
Reorganizar el apartado `Menu` del admin para que el equipo pueda gestionar carta, categorias, portada y promociones con menos riesgo de error, mejor jerarquia visual y controles mas claros, manteniendo la logica de negocio actual sin tocar pagos, Stripe, checkout ni calculos de descuentos.

## Flujo
SECUENCIA
```
Admin
  |
  | abre /admin/menu
  v
AdminMenuShell
  |
  | carga datos iniciales
  v
API admin
  |
  | productos + categorias + portada + promos
  v
AdminMenuShell
  |
  | muestra resumen operativo
  v
Secciones principales
  |
  | Productos | Categorias | Portada | Promos | Extras
  v
Vista de trabajo elegida
  |
  | abrir crear/editar en panel dedicado
  v
Formulario con validacion local
  |
  | guardar solo esa entidad
  v
API admin
  |
  | respuesta OK o error
  v
Pantalla actualizada sin sacar al admin de contexto
```

DECISIONES
```
Admin entra en Menu
   |
   v
datos cargan correctamente?
   | no
   v
mostrar error claro + boton reintentar

   | si
   v
mostrar resumen + navegacion por secciones
   |
   v
que quiere gestionar?
   |
   +--> productos
   |       |
   |       v
   |    tabla/lista con busqueda, filtros, estado e imagen
   |       |
   |       v
   |    crear/editar en panel lateral o formulario dedicado
   |
   +--> categorias
   |       |
   |       v
   |    lista compacta + crear/editar + disponibilidad
   |
   +--> portada
   |       |
   |       v
   |    formulario unico + vista previa controlada
   |
   +--> promos
   |       |
   |       v
   |    listado de promos + estado + fechas + productos afectados
   |
   +--> extras
           |
           v
        gestion guiada por producto o grupo

accion modifica algo sensible?
   | si
   v
confirmacion explicita antes de ejecutar

   | no
   v
validar campos en cliente
   |
   v
validacion correcta?
   | no
   v
mostrar error junto al campo y conservar cambios

   | si
   v
llamar API
   |
   v
API responde OK?
   | no
   v
mostrar error accionable y conservar formulario

   | si
   v
actualizar datos + mostrar confirmacion + mantener contexto
```

## Restricciones
- Todo se trabaja en local primero.
- No hacer push a GitHub ni tocar produccion hasta autorizacion explicita del propietario.
- No tocar backend, Prisma, Stripe, checkout, calculo de descuentos, webhooks, autenticacion ni roles en esta fase.
- No cambiar el comportamiento publico del cliente salvo que una tarea lo diga expresamente y sea aprobada.
- No migrar a un kit visual completo que obligue a rehacer todo el CSS del proyecto.
- No introducir Tailwind como dependencia obligatoria en esta fase.
- No actualizar React/Next como parte de esta tarea. React 19.3 o superior queda como tarea separada de compatibilidad.
- Mantener la paleta y los tokens actuales de `apps/web/app/globals.css`.
- Mantener `lucide-react` para iconos.
- Las nuevas librerias deben resolver problemas concretos de usabilidad, accesibilidad o formularios; no se agregan por estetica.
- Cada tarea debe ser pequena, verificable y reversible.
- Los formularios deben conservar cambios cuando la API devuelva error.
- Las acciones sensibles deben pedir confirmacion: desactivar producto, agotar producto, borrar imagen, desactivar promo activa o cambiar una promo con descuento real.

## Fuera de alcance
- Redisenar la web publica del cliente.
- Cambiar precios, promociones reales, Stripe, efectivo/caja o reportes.
- Crear un CMS completo.
- Crear roles nuevos o permisos nuevos.
- Drag and drop para ordenar productos o categorias.
- Subida masiva de productos.
- Edicion inline masiva.
- WebSocket/SSE o tiempo real.
- Cambio global de branding desde admin.

## Tareas
### T1: Base tecnica y dependencias de UI operativa
- **Hacer:** agregar solo las dependencias necesarias para mejorar accesibilidad, formularios y tablas:
  - Radix UI primitives para dialogos, confirmaciones, tabs/selects/switches/checkboxes/tooltips.
  - `react-hook-form`, `zod` y `@hookform/resolvers` para validar formularios antes de llamar a la API.
  - `@tanstack/react-table` para organizar productos/promos con filtros, columnas y estados.
- **Archivos:** `apps/web/package.json`, `package-lock.json`.
- **Verify:** `npm.cmd install`, `npm.cmd run lint -w @mordida/web`, `npm.cmd run build -w @mordida/web`.

### T2: Separar el monolito en una estructura mantenible
- **Hacer:** extraer tipos, helpers de formato/validacion visual y componentes base de admin menu sin cambiar comportamiento.
- **Archivos:** `apps/web/components/admin-menu-client.tsx`, `apps/web/components/admin-menu/types.ts`, `apps/web/components/admin-menu/menu-admin-utils.ts`.
- **Verify:** `npm.cmd run lint -w @mordida/web`, `npm.cmd run build -w @mordida/web`.

### T3: Shell operativo y navegacion interna unica
- **Hacer:** convertir `/admin/menu` en una pantalla con un solo menu interno completo: resumen superior, secciones claras y estado activo consistente. La navegacion interna debe reemplazar bloques duplicados o confusos.
- **Archivos:** `apps/web/components/admin-menu-client.tsx`, `apps/web/components/admin-menu/menu-admin-shell.tsx`, `apps/web/app/globals.css`.
- **Verify:** manual local: abrir `/admin/menu`, cambiar entre Productos/Categorias/Portada/Promos/Extras, comprobar que no hay dos navegaciones internas compitiendo.

### T4: Productos como tabla/lista profesional
- **Hacer:** reorganizar productos con TanStack Table: busqueda, filtro por categoria, filtro por disponibilidad, columna de imagen, precio, estado, promos asociadas y acciones claras.
- **Archivos:** `apps/web/components/admin-menu/products-section.tsx`, `apps/web/components/admin-menu/product-table.tsx`, `apps/web/app/globals.css`.
- **Verify:** manual local: buscar producto, filtrar por categoria, filtrar agotados/disponibles, editar desde accion de fila, comprobar que la lista no pierde posicion sin razon.

### T5: Crear/editar producto con formulario guiado
- **Hacer:** mover crear/editar producto a un panel o dialogo dedicado con React Hook Form + Zod, errores junto al campo, vista previa de imagen, estado disponible/agotado claro y confirmacion para acciones sensibles.
- **Archivos:** `apps/web/components/admin-menu/product-form-panel.tsx`, `apps/web/components/admin-menu/product-schema.ts`, `apps/web/components/admin-menu/products-section.tsx`.
- **Verify:** manual local: crear producto invalido muestra errores sin llamar API; crear producto valido guarda; editar imagen/precio/categoria conserva datos si falla API.

### T6: Categorias y extras con gestion separada
- **Hacer:** separar categorias y grupos extra de la lista principal para evitar que el admin edite extras por accidente mientras gestiona productos. Debe haber estados claros para activo/inactivo y confirmacion para desactivar.
- **Archivos:** `apps/web/components/admin-menu/categories-section.tsx`, `apps/web/components/admin-menu/extras-section.tsx`, `apps/web/app/globals.css`.
- **Verify:** manual local: crear/editar categoria, activar/desactivar categoria, crear/editar grupo extra y opcion, confirmar que productos siguen mostrando sus grupos correctamente.

### T7: Portada y promociones en superficies dedicadas
- **Hacer:** mantener `Portada` y `Promos` como secciones separadas, con vista previa compacta, estado activo/inactivo visible, validacion de campos y confirmacion antes de desactivar una promo activa.
- **Archivos:** `apps/web/components/admin-menu/brand-section.tsx`, `apps/web/components/admin-menu/promotions-section.tsx`, `apps/web/app/globals.css`.
- **Verify:** manual local: guardar portada, crear/editar promo, desactivar promo, confirmar que no se toca checkout ni calculo de precios.

### T8: Responsive, accesibilidad y pulido de errores
- **Hacer:** revisar teclado/focus, tooltips, estados loading/error/empty, mobile, textos que se cortan, confirmaciones y consistencia visual con la paleta actual.
- **Archivos:** `apps/web/components/admin-menu/*.tsx`, `apps/web/app/globals.css`.
- **Verify:** manual local desktop y movil: no hay solapes, todos los dialogos devuelven foco, los botones tienen etiqueta clara, no hay errores de consola.

### T9: Prueba local completa antes de autorizar push
- **Hacer:** ejecutar verificacion final de la pantalla completa con datos reales locales.
- **Archivos:** no aplica.
- **Verify:** `npm.cmd run lint -w @mordida/web`, `npm.cmd run build -w @mordida/web`, smoke test local de `/admin/menu`.

## Done (validacion final)
- [ ] `npm.cmd install` termina correctamente despues de agregar dependencias.
- [ ] `npm.cmd run lint -w @mordida/web` pasa.
- [ ] `npm.cmd run build -w @mordida/web` pasa.
- [ ] Manual local: `/admin/menu` carga sin errores de consola.
- [ ] Manual local: solo hay una navegacion interna clara dentro del menu admin.
- [ ] Manual local: productos se buscan, filtran, crean, editan, activan/desactivan.
- [ ] Manual local: categorias se crean, editan y activan/desactivan.
- [ ] Manual local: extras se crean, editan y activan/desactivan sin romper productos.
- [ ] Manual local: portada se edita y conserva vista previa.
- [ ] Manual local: promociones se crean/editan/desactivan y muestran estado claro.
- [ ] Manual local: formularios invalidos muestran errores junto al campo.
- [ ] Manual local: acciones sensibles piden confirmacion.
- [ ] Manual local movil: no hay solapes ni texto cortado.
- [ ] Manual local: carrito/menu publico no se rompe por cambios del admin.
- [ ] No hay push a GitHub ni despliegue hasta autorizacion explicita.
