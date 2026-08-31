# Mordida Tasty - Hoja de ruta a produccion

Estado actualizado: 2026-08-31

## Cerrado

- [x] Checkout con `Idempotency-Key` para evitar pedidos duplicados.
- [x] Sesiones en cookies `httpOnly` en vez de `localStorage`.
- [x] Consentimiento legal en registro y checkout.
- [x] Coste de envio editable desde admin.
- [x] Horarios editables desde admin.
- [x] Pantalla de cocina separada en `/admin/cocina`.
- [x] Seguimiento publico no adivinable con `trackingToken`.
- [x] Rol separado `KITCHEN` para cocina.
- [x] 2FA obligatorio para administradores.
- [x] Recuperacion de contrasena completa en frontend.
- [x] Stripe robusto ante pagos tardios de pedidos cancelados.
- [x] SMTP obligatorio para produccion.
- [x] Bloquear cancelacion directa de pedidos pagados sin flujo de reembolso completo.
- [x] Reportes de ventas por rango.
- [x] Quitar producto de pedido pagado con baja logica y reembolso parcial real en Stripe.
- [x] Rate limiting global basico.
- [x] Hoja de ruta de produccion mantenida en `docs/HOJA_RUTA_PRODUCCION.md`.
- [x] Pruebas automatizadas base de auth, configuracion, cookies y maquina de estados.
- [x] Script de arranque real de API corregido a `dist/src/main.js`.
- [x] Migraciones de produccion con `prisma migrate deploy`.
- [x] Seed de produccion idempotente que no pisa ajustes ni contrasenas existentes.
- [x] Dockerfiles de produccion para API y web.
- [x] Plantilla `.env.production.example` para variables reales.
- [x] Guia de despliegue en `docs/DESPLIEGUE_PRODUCCION.md`.
- [x] Guia de variables en `docs/VARIABLES_PRODUCCION.md`.
- [x] Script operativo para resetear 2FA de admin si se pierde el codigo.
- [x] Redisenyo inicial moderno de home, menu, formularios, admin y cocina.
- [x] Marca, colores, fuente e icono documentados para cambios futuros.
- [x] Header publico sin enlace visible a administracion.
- [x] Tarjetas de menu reajustadas para mostrar el producto completo como protagonista.
- [x] Portada, textos de inicio, producto destacado y fuente editables desde admin.
- [x] Categorias administrables desde admin: crear, ordenar, ocultar y reactivar.
- [x] Subida de imagenes desde el ordenador para portada y productos.
- [x] Categorias ocultas bloqueadas tambien en detalle publico, carritos antiguos y checkout backend.
- [x] Pedidos de hoy, reportes y numeracion diaria usando `APP_TIMEZONE`.
- [x] Variables obligatorias de produccion ampliadas con `API_PUBLIC_URL` y `UPLOAD_DIR`.
- [x] Plantilla Render preparada con Persistent Disk para imagenes subidas desde admin.
- [x] Limites de pedido publico: maximo 30 lineas y 25 unidades por producto.
- [x] Horarios editables validados por backend antes de guardar.
- [x] Horarios nocturnos corregidos: rangos como `20:00-02:00` mantienen abierto el servicio despues de medianoche.
- [x] Webhook de Stripe excluido del rate limiting global para evitar rechazar confirmaciones reales de pago.
- [x] Solicitudes RGPD con limite especifico para reducir abuso sin afectar pagos ni pedidos normales.
- [x] Estados de pedido compartidos en backend y frontend para evitar reglas duplicadas y botones inconsistentes.
- [x] Utilidades compartidas de horarios y errores admin en frontend para reducir duplicacion critica.
- [x] Endpoint interno `/admin/auth/me` para validar sesiones de admin/cocina sin depender del endpoint publico de cliente.
- [x] Registro sin error tecnico tras crear cuenta cuando no hay formulario pendiente que reiniciar.
- [x] Direcciones de cliente editables y eliminables desde la cuenta, sin tocar base de datos a mano.
- [x] Carrito conservado si Stripe se cancela; se vacia al volver al seguimiento real del pedido.
- [x] Botones de estado admin alineados con la maquina de estados del backend.
- [x] Tickets de admin y cocina usando el nombre editable de marca.
- [x] Pruebas fase 6 ampliadas: checkout Stripe con idempotencia, webhooks, pagos tardios, pagos fallidos, expiraciones, reembolsos parciales, permisos cocina y direcciones cliente.
- [x] Guia de ampliacion admin profesional creada en `docs/AMPLIACION_ADMIN_PROFESIONAL.md`.
- [x] Gestion de staff implementada: crear admin/cocina, editar, activar/desactivar, resetear 2FA y enviar recuperacion de contrasena.
- [x] Usuarios desactivados bloqueados tambien con cookies antiguas mediante guard JWT.
- [x] Cierres especiales y pausa temporal implementados desde admin con motivo visible en home/checkout.
- [x] Checkout bloqueado con el motivo real cuando el servicio esta pausado o en cierre especial.
- [x] Zonas de reparto implementadas desde admin: codigos exactos/prefijos, pedido minimo, coste por zona, activacion y desactivacion.
- [x] Checkout cotiza envio por codigo postal y bloquea pedidos fuera de cobertura o por debajo del minimo.
- [x] Busqueda y filtros de pedidos en admin: texto, estado, metodo de entrega, rango de fechas y paginacion simple.
- [x] Cancelacion completa de pedidos pagados con reembolso real en Stripe, idempotencia por pedido, `PaymentRefund`, historial y auditoria.
- [x] Opciones y extras de productos: grupos/opciones desde admin, selector publico, calculo backend, snapshot en pedido y visualizacion en carrito, checkout, admin, cocina, seguimiento y ticket.
- [x] Dashboard admin principal reorganizado: pedidos al centro y ajustes separados por Servicio, Negocio, Horarios y 2FA.
- [x] WhatsApp e Instagram editables desde `/admin/menu` y visibles en la portada publica cuando estan configurados.
- [x] Auditoria de codigo 2026-08-31: login publico limitado a clientes, clientes sin email verificado bloqueados, variables numericas de entorno validadas y formato de extras centralizado.
- [x] Build de Render corregido: instala dependencias de compilacion con `npm ci --include=dev` aunque `NODE_ENV=production` y limpia despues con `npm prune --omit=dev`.
- [x] Modulo backend de subidas incluido en Git: `.gitignore` ahora ignora solo `/uploads/` de runtime y no `apps/api/src/uploads`.
- [x] Validacion actual: `npm run test -w @mordida/api` (12 suites, 81 tests), `npm run lint` y `npm run build`.

## En curso

- [ ] Completar prueba e2e real contra Postgres temporal y Stripe CLI antes del lanzamiento publico.
- [ ] Elegir proveedor final: Render, AWS o arquitectura mixta con Cloudflare.
- [ ] Cargar variables reales de produccion: dominio, Stripe live, SMTP, JWT y Postgres gestionado.

## Pendiente antes de lanzar

- [ ] Textos legales finales: razon social, NIF/CIF, direccion fiscal, email legal y politica real.
- [ ] Fotos reales definitivas del menu y revision final de contenido.
- [ ] Prueba real de pago con Stripe live antes de abrir al publico.
- [ ] Convertir la experiencia cliente en app instalable/PWA para moviles: manifest, iconos, nombre, color de marca y apertura directa en la zona de pedidos.
- [ ] Revision visual final con fotos reales, textos finales y dominio real.

## Orden recomendado

1. Completar ampliacion admin profesional: staff, cierres, reparto, filtros, reembolso completo y opciones/extras.
2. Completar prueba e2e real con Postgres temporal, Stripe CLI y flujo cocina.
3. Revisar interfaz grafica final con fotos reales del restaurante.
4. Completar textos legales reales.
5. Elegir proveedor final y crear servicios reales.
6. Cargar variables reales de produccion.
7. Ejecutar migraciones y seed en produccion.
8. Activar la app instalable/PWA para clientes moviles.
9. Probar pago real, correo, tracking, ticket, cocina, reportes y app instalada antes de abrir.
