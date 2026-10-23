# Identificacion fiable de clientes en CRM

## Contexto

- Cada cuenta registrada ya tiene `User.id` unico y `User.email` unico.
- El registro convierte el correo a minusculas, pero el telefono no tiene una normalizacion comun.
- El codigo postal ya existe en `CustomerAddress.postalCode`; en pedidos con reparto tambien queda en `Order.deliveryPostalCode`.
- El CRM actual muestra solo cuentas `User` con rol `CLIENTE` y oculta sus datos de contacto en la tabla. Por eso dos cuentas con el mismo nombre parecen duplicadas.
- Los pedidos invitados tienen `Order.userId = null`; no son cuentas registradas y por eso no aparecen en la lista actual de clientes.
- Se mantendran NestJS, Prisma, PostgreSQL, Next.js 16 y React 19. No hace falta crear otro sistema de perfiles ni actualizar todo el stack para resolver este problema.
- Si se agrega una dependencia para telefonos se usara la ultima version estable compatible de `libphonenumber-js`, fijada exactamente en el lockfile y comprobada con `npm audit`.

## Objetivo

Mostrar y distinguir correctamente cuentas registradas y compradores invitados mediante ID, correo, telefono y codigo postal, evitando nuevas compras mal atribuidas sin fusionar ni borrar datos.

## Flujo

```text
SECUENCIA (orden temporal hacia abajo)
1. Administrador -> CRM: abre Clientes.
2. CRM -> API: solicita registrados o invitados con filtros y paginacion.
3. API -> PostgreSQL: consulta User, direccion predeterminada y pedidos invitados.
4. PostgreSQL -> API: devuelve ID, correo, telefono, codigo postal y actividad.
5. API -> CRM: entrega datos enmascarados y alertas de coincidencia.
6. CRM -> Administrador: muestra cada registro con identidad distinguible.
7. Cliente -> Checkout: envia pedido con o sin sesion.
8. API -> Cliente: renueva una sesion vencida o solicita login; no la convierte en invitada.
9. API -> PostgreSQL: guarda el pedido con User.id o como invitado real.
```

```text
persona visible en CRM
        |
        v
tiene User.id? --si--> CUENTA REGISTRADA
        |                  |-- ID corto
        |                  |-- correo
        |                  |-- telefono
        |                  +-- CP de direccion predeterminada
        |
        no
        v
pedido con userId null --> COMPRADOR INVITADO
                           |-- ID visual INV-...
                           |-- correo del pedido
                           |-- telefono del pedido
                           +-- CP del reparto, si existe

coincide el nombre? ------------> solo dato visual, no une personas
coincide el codigo postal? ------> solo ubicacion, no une personas
coincide telefono normalizado? --> marcar posible duplicado
coincide correo normalizado? ----> auditar; nunca fusionar automaticamente
```

## Restricciones

- `User.id` es la identidad principal de una cuenta registrada.
- El correo normalizado es el identificador secundario y debe seguir siendo unico.
- El telefono normalizado a E.164 sirve para detectar candidatos, pero no sera unico porque puede ser compartido.
- El codigo postal es informativo y opcional; nunca identifica por si solo a una persona.
- Para una cuenta se usa primero la direccion predeterminada y, si no existe, la direccion actualizada mas recientemente.
- Para un invitado se usa el codigo postal del pedido con reparto. Una recogida puede no tener codigo postal.
- No borrar, fusionar ni modificar automaticamente cuentas, pedidos, pagos, fidelidad o sesiones existentes.
- Los datos de contacto se muestran enmascarados en la tabla y completos solo en el detalle administrativo ya protegido.
- Una peticion sin cookie puede comprar como invitada. Una cookie cliente invalida recibe `401` y no se degrada silenciosamente a invitada.
- No escribir correo, telefono, direccion ni codigo postal completos en logs.
- No hacer push, despliegue o correcciones de datos de produccion sin autorizacion escrita.
- Se utilizaran versiones estables actuales y compatibles; nunca `alpha`, `beta` o `RC`.

## Fuera de alcance

- Crear un segundo modelo completo de cliente o migrar todas las cuentas a otra tabla.
- Fusionar dos cuentas registradas desde el CRM.
- Verificacion por SMS, automatizaciones de marketing o almacenamiento de tarjetas.
- Modificar precios, descuentos, promociones, efectivo, fidelidad o el flujo de pago.
- Actualizar NestJS, Prisma o TypeScript como parte de esta correccion funcional.

## Tareas

### T1: Normalizar identificadores

- **Hacer:** centralizar correo en minusculas, telefono E.164 y codigo postal sin espacios o guiones innecesarios. Crear funciones para enmascarar correo y telefono en listados.
- **Archivos:** `apps/api/src/common/customer-identifier.ts`, `apps/api/src/common/customer-identifier.spec.ts`, `apps/api/package.json` solo si se agrega `libphonenumber-js`.
- **Verify:** tests con correos en mayusculas, telefonos nacionales/internacionales, entradas invalidas y codigos postales espanoles.

### T2: Corregir atribucion de pedidos

- **Hacer:** distinguir ausencia de sesion de cookie invalida. Renovar una vez antes de `POST /orders`; si falla, solicitar login y no crear el pedido como invitado. Conservar la misma clave de idempotencia.
- **Archivos:** `apps/api/src/common/guards/jwt-auth.guard.ts`, `apps/web/lib/api.ts` y sus tests existentes.
- **Verify:** cuenta valida crea pedido con `userId`; invitado real crea pedido sin `userId`; cookie vencida se renueva y crea un solo pedido; cookie invalida no crea pedido.

### T3: Ampliar API del CRM

- **Hacer:** anadir a cada cuenta ID corto, correo/telefono enmascarados, verificacion y codigo postal de su direccion. Anadir una vista separada de compradores invitados agrupados conservadoramente por correo y telefono normalizados, sin mezclarlos con cuentas registradas.
- **Archivos:** `apps/api/src/admin-customers/admin-customers.service.ts`, `apps/api/src/admin-customers/admin-customers.service.spec.ts`, DTO existente de listado.
- **Verify:** dos personas con igual nombre tienen IDs diferentes; registrado e invitado quedan separados; paginacion no repite IDs; cuenta sin direccion devuelve CP vacio.

### T4: Hacer visible la identidad

- **Hacer:** agregar columnas compactas `ID`, `Correo`, `Telefono` y `CP`, badges `Registrado`, `Pendiente` o `Invitado`, y filtro segmentado entre registrados e invitados. Marcar posibles coincidencias sin ofrecer fusion automatica.
- **Archivos:** `apps/web/components/admin-customers/customer-table.tsx`, `apps/web/lib/types.ts` y prueba de componente o E2E.
- **Verify:** escritorio, tablet y movil muestran identidades distinguibles sin desbordamiento; el detalle sigue mostrando los datos administrativos autorizados.

### T5: Auditar y cerrar

- **Hacer:** generar conteos de cuentas registradas, pendientes, invitados y coincidencias por correo/telefono; ejecutar regresion de registro, login, cuenta, checkout y CRM. Documentar cualquier candidato historico para revision manual.
- **Archivos:** `e2e/customer-identification.spec.ts`, `docs/AUDITORIA_IDENTIDAD_CLIENTES.md`.
- **Verify:** `npm run lint && npm run test && npm run build && npm run test:e2e && npm audit --omit=dev`.

## Done (validacion final)

- [x] Cada cuenta registrada aparece una sola vez por `User.id`.
- [x] Dos clientes con el mismo nombre se distinguen mediante ID y contacto enmascarado.
- [x] El codigo postal procede de la direccion predeterminada o mas reciente y puede estar vacio.
- [x] Los compradores invitados aparecen en una vista separada y no se presentan como cuentas registradas.
- [x] Una sesion vencida no convierte el pedido de un cliente en pedido invitado.
- [x] No se ha borrado, fusionado ni reasignado ningun dato historico.
- [x] Lint, tests, build, E2E y auditoria de dependencias pasan.
- [x] No se despliega hasta revisar el informe local y recibir autorizacion.
