# Admin tablet: operacion e impresora

## Contexto

- El admin actual ya tiene pantallas separadas para Pedidos, Cocina, Reparto, Staff, Reportes y Menu en `apps/web/components/`.
- La pantalla mas usada en servicio real es Pedidos, implementada en `apps/web/components/admin-orders-client.tsx`.
- Cocina ya esta optimizada para actualizacion frecuente y sonido en `apps/web/components/admin-kitchen-client.tsx`.
- La impresion de pedidos usa `apps/web/lib/order-ticket-print.ts`, que abre una ventana limpia para imprimir el ticket.
- El problema real en tablet es doble: la vista diaria esta saturada y la configuracion de impresora no debe ocupar espacio permanente.
- Decision tomada: Impresora/Ticket no va en Menu. Va dentro de Ajustes operativos, como configuracion secundaria.

## Objetivo

Reducir la saturacion del admin en tablet y preparar una configuracion de ticket/impresora sin interferir con el flujo diario de pedidos.

## Flujo

```
SECUENCIA (orden temporal abajo)
1. Staff -> Pedidos: abre panel operativo
2. Pedidos -> API: carga pedidos, dashboard y ajustes
3. API -> Pedidos: devuelve datos
4. Pedidos -> Staff: muestra solo lo diario: pedidos, filtros, sonido y acciones
5. Staff -> Pedidos: pulsa Ajustes cuando necesita configurar algo
6. Pedidos -> Panel Ajustes: abre configuracion secundaria
7. Staff -> Panel Ajustes: cambia servicio/negocio/horarios/impresora
8. Panel Ajustes -> API: guarda cambios cuando corresponde
9. Staff -> Pedido/Cocina: imprime ticket
10. Web -> Navegador/Android: abre impresion limpia
11. Android -> Impresora: imprime si el sistema tiene impresora configurada
```

```
entrada: staff trabaja desde tablet
   |
   v
esta en flujo diario?
   | si
   v
mostrar pedidos + acciones frecuentes
   |
   v
necesita ajustes?
   | no
   v
seguir operando pedidos

necesita ajustes?
   | si
   v
abrir panel secundario
   |
   v
quiere configurar ticket?
   | no
   v
usar ajustes actuales

quiere configurar ticket?
   | si
   v
mostrar opciones de ticket
   |
   v
modo impresion navegador?
   | si
   v
abrir dialogo de Android/Chrome
   |
   v
Android encuentra impresora?
   | si -> imprime
   | no -> mostrar aviso de driver/Print Service/app puente

modo impresion puente/app?
   | si
   v
enviar ticket a app local ESC/POS
```

## Restricciones

- No tocar Stripe, checkout, descuentos, pagos ni calculos de totales.
- No cambiar contratos de API existentes sin tarea propia.
- No meter dependencias nuevas para la fase visual/operativa.
- No saturar Pedidos ni Cocina con configuraciones que se usan pocas veces.
- Sin push ni despliegue hasta autorizacion explicita.
- La web no puede seleccionar ni conectar impresoras Bluetooth directamente desde el navegador normal; eso queda documentado y separado.

## Fuera de alcance

- App Android nativa o puente ESC/POS.
- Impresion silenciosa sin dialogo del sistema.
- Rehacer por completo todas las pantallas del admin en una sola fase.
- Cambios en la carta del cliente.

## Tareas

### T1: Sacar Ajustes del flujo principal de Pedidos

- **Hacer:** convertir el panel lateral de Ajustes en un panel bajo demanda, abierto por boton. En tablet debe liberar espacio para pedidos.
- **Archivos:** `apps/web/components/admin-orders-client.tsx`, `apps/web/app/globals.css`.
- **Verify:** abrir `/admin`, confirmar que los pedidos ocupan el ancho principal, que Ajustes abre/cierra, y que guardar Servicio/Negocio sigue funcionando.

### T2: Compactar acciones de pedido en tablet

- **Hacer:** mejorar tarjetas de pedido para que en tablet se lean por prioridad: numero, hora, pago, cliente/productos, total y acciones.
- **Archivos:** `apps/web/components/admin-orders-client.tsx`, `apps/web/app/globals.css`.
- **Verify:** con pedidos de tarjeta y efectivo, confirmar que imprimir, cambiar estado y efectivo cobrado siguen visibles y usables.

### T3: Preparar seccion Impresora/Ticket dentro de Ajustes

- **Hacer:** anadir pestana compacta `Impresora` en Ajustes con texto claro del modo actual: navegador/Android Print. Incluir boton de ticket de prueba usando un pedido de ejemplo local en frontend.
- **Archivos:** `apps/web/components/admin-orders-client.tsx`, `apps/web/lib/order-ticket-print.ts`, `apps/web/app/globals.css`.
- **Verify:** abrir Ajustes -> Impresora y pulsar `Ticket de prueba`; debe abrir una ventana de ticket limpio sin datos reales de cliente.

### T4: Configuracion persistente de formato de ticket

- **Hacer:** guardar opciones de ticket en backend: ancho 58/80mm, letra pequena/normal/grande, copias, secciones visibles y texto final.
- **Archivos:** API settings module, Prisma schema/migration, tipos web.
- **Verify:** guardar configuracion, recargar admin y confirmar que persiste.

### T5: Aplicar configuracion al ticket real

- **Hacer:** hacer que `openPrintableOrderTicket` use la configuracion guardada para el ancho, tipografia y secciones.
- **Archivos:** `apps/web/lib/order-ticket-print.ts`, `apps/web/components/admin-orders-client.tsx`, `apps/web/components/admin-kitchen-client.tsx`.
- **Verify:** imprimir ticket real y ticket de prueba con 58mm y 80mm; confirmar que no aparece UI de la pagina.

### T6: Diagnostico de impresora en tablet

- **Hacer:** documentar y mostrar checklist operativo para Android: impresora emparejada, servicio de impresion instalado, prueba desde Android, y alternativa con app puente.
- **Archivos:** spec/docs y seccion Impresora del admin.
- **Verify:** en la tablet, confirmar si Android lista la impresora. Si no la lista, marcar fase puente/app como pendiente.

## Done (validacion final)

- [ ] `npm run lint -w @mordida/web` pasa.
- [ ] `npm run build -w @mordida/web` pasa.
- [ ] Manual desktop: Pedidos abre, Ajustes no ocupa espacio hasta pedirlo, imprimir abre ticket limpio.
- [ ] Manual tablet: Pedidos se ve menos saturado, acciones frecuentes quedan accesibles.
- [ ] Manual tablet: ticket de prueba abre dialogo de impresion; si no detecta impresora, se muestra el camino correcto para configurar Android/driver.
