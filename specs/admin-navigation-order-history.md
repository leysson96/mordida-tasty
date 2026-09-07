# Navegacion admin e historial de pedidos

## Contexto
- El proyecto es un monorepo con `apps/api` en NestJS/Prisma y `apps/web` en Next.js.
- La navegacion global del admin vive en `apps/web/components/site-header.tsx`.
- Varias pantallas admin tambien pintan botones propios dentro de `admin-toolbar`, por ejemplo `apps/web/components/admin-orders-client.tsx`, y eso duplica el menu visual.
- Reportes ya consume `/admin/reports/sales` desde `apps/web/components/admin-reports-client.tsx`.
- El backend ya tiene historial tecnico de estados en `OrderStatusHistory` y `OrdersService` lo incluye en los pedidos con `statusHistory`.
- Los pedidos admin ya se pueden buscar con `/admin/orders` por numero, cliente, email, telefono, metodo, estado y fechas.

## Objetivo
Unificar el admin en una sola navegacion superior completa y definir un historial de pedidos consultable desde el area de reportes sin tocar pagos, autenticacion ni el flujo de cocina.

## Flujo

```text
SECUENCIA (orden temporal abajo)
1. Admin -> /admin o cualquier ruta /admin/*: abre una pantalla interna.
2. SiteHeader -> navegador: detecta ruta admin y muestra una barra superior completa.
3. Admin -> SiteHeader: navega con Pedidos, Menu, Reportes, Reparto, Staff, Cocina o Salir.
4. Pantalla admin -> navegador: muestra solo el titulo y sus controles propios, sin repetir la navegacion.
5. Admin -> /admin/reportes: abre analitica del negocio.
6. Reportes -> API: pide metricas de ventas con /admin/reports/sales.
7. Reportes -> API: cuando el admin usa Historial, pide pedidos con /admin/orders y filtros.
8. API -> Reportes: devuelve pedidos con cliente, pago, entrega, productos y statusHistory.
9. Admin -> Reportes: abre un pedido concreto y revisa detalle operativo e historial de cambios.
```

```text
FLUJO (decisiones y casos borde)
Admin entra en una ruta /admin/*
    |
    v
Es ruta admin?
    | no
    v
Header cliente normal: Menu, Pedido, Cuenta, carrito

    | si
    v
Header admin completo: Pedidos, Menu, Reportes, Reparto, Staff, Cocina, Salir
    |
    v
La pagina actual tiene botones duplicados de navegacion?
    | si
    v
Quitar botones repetidos y dejar solo titulo/acciones propias de esa pantalla

    | no
    v
Mantener contenido actual
    |
    v
Admin abre Reportes
    |
    v
Quiere ver metricas o historial?
    | metricas
    v
Mostrar ingresos, pedidos, ticket medio, dias y productos vendidos

    | historial
    v
Mostrar filtros de pedido, cliente, estado, pago, entrega y fechas
    |
    v
Hay pedidos para el filtro?
    | no
    v
Mostrar estado vacio claro sin romper la pagina

    | si
    v
Mostrar lista de pedidos
    |
    v
Admin abre detalle
    |
    v
Mostrar cliente, direccion si aplica, telefono, productos, total, pago, cambio, estado e historial
```

## Restricciones
- No tocar el flujo de pago, Stripe, efectivo, reembolsos ni calculo de importes.
- No tocar autenticacion, roles ni permisos del backend.
- No cambiar el modelo de datos ni crear migraciones para esta fase.
- No agregar dependencias nuevas.
- La navegacion debe seguir usando rutas existentes: `/admin`, `/admin/menu`, `/admin/reportes`, `/admin/reparto`, `/admin/staff`, `/admin/cocina`.
- El historial debe reutilizar `/admin/orders` antes de crear endpoints nuevos.

## Fuera de alcance
- Exportacion CSV/PDF de reportes.
- Graficas avanzadas, comparativas por semana/mes o analitica predictiva.
- Cambios fiscales, facturacion legal o integracion contable.
- Cambios en cocina, impresion de tickets, checkout, fidelidad o emails.

## Tareas

### T1: Navegacion admin unica
- **Hacer:** completar el header admin con Reparto, Staff y Salir; quitar de `/admin` la fila duplicada de botones Menu/Reportes/Reparto/Staff/Cocina/Salir.
- **Archivos:** `apps/web/components/site-header.tsx`, `apps/web/components/admin-orders-client.tsx`, `apps/web/app/globals.css`.
- **Verify:** `npm.cmd run lint -w @mordida/web` y `npm.cmd run build -w @mordida/web`.

### T2: Historial dentro de reportes
- **Hacer:** agregar en `/admin/reportes` una zona de historial de pedidos con busqueda por texto, estado, metodo de pago, tipo de entrega y rango de fechas usando `/admin/orders`.
- **Archivos:** `apps/web/components/admin-reports-client.tsx`, `apps/web/app/globals.css`, `apps/web/lib/types.ts`.
- **Verify:** `npm.cmd run lint -w @mordida/web` y `npm.cmd run build -w @mordida/web`.

### T3: Detalle operativo del pedido
- **Hacer:** permitir abrir un pedido del historial para ver cliente, telefono, direccion/notas, productos, totales, pago, cambio en efectivo e historial de estados.
- **Archivos:** `apps/web/components/admin-reports-client.tsx`, `apps/web/app/globals.css`.
- **Verify:** `npm.cmd run lint -w @mordida/web` y `npm.cmd run build -w @mordida/web`.

### T4: Limpieza final y prueba de flujo
- **Hacer:** revisar que no queden menus duplicados, que el historial no rompa rangos sin datos y que no se hayan tocado pagos/auth.
- **Archivos:** solo archivos ya tocados en T1-T3 si aparece un ajuste menor.
- **Verify:** `npm.cmd run lint -w @mordida/web`, `npm.cmd run build -w @mordida/web` y prueba manual: entrar en `/admin`, `/admin/menu`, `/admin/reportes`, buscar un pedido y abrir detalle.

## Done (validacion final)
- [ ] `npm.cmd run lint -w @mordida/web` pasa.
- [ ] `npm.cmd run build -w @mordida/web` pasa.
- [ ] Manual: en `/admin` solo se ve un menu principal admin, completo y navegable.
- [ ] Manual: en `/admin/reportes` se pueden ver metricas e historial sin perder filtros.
- [ ] Manual: abrir un pedido muestra datos operativos suficientes para consultar que paso con ese pedido.
