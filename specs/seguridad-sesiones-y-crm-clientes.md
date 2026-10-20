# Seguridad de sesiones y CRM de clientes

## Contexto
- Monorepo con API NestJS 11, Prisma/PostgreSQL y web Next.js 16 con React 19.
- La autenticacion actual usa JWT en cookies `HttpOnly`; los clientes caducan a
  los 7 dias y el personal a las 12 horas.
- Existe trabajo local sin commit para registrar y revocar sesiones. Debe
  adaptarse al flujo de renovacion silenciosa antes de considerarlo terminado.
- La cuenta del cliente ya muestra pedidos, direcciones, fidelidad y confianza
  para efectivo. No existe un CRM interno de clientes.
- `User`, `Order`, fidelidad y confianza de efectivo ya contienen casi todos los
  datos necesarios. Las metricas del CRM se calcularan en backend y no se
  duplicaran sin necesidad.
- Patrones a respetar: DTO con `class-validator`, autorizacion con guards y
  roles, Prisma para persistencia, auditoria en `AuditLog`, Jest/Supertest en la
  API y Playwright para flujos reales.
- Dependencias verificadas el 20/10/2026: el registro publico marca React
  19.3.1, Next.js 16.4.2 y Playwright 1.64.1 como versiones estables actuales.
  El repositorio usa React 19.2.8, Next.js 16.3.8 y Playwright 1.63.0.
- Las actualizaciones se haran de una en una y solo si son compatibles. No se
  usaran rangos `latest`, librerias abandonadas ni actualizaciones masivas.
- Para criptografia se usara `node:crypto` (AES-256-GCM y aleatoriedad segura),
  evitando agregar una dependencia externa para una capacidad nativa.
- Para el CRM se reutilizaran TanStack Table, componentes Radix/shadcn ya
  compatibles, React Hook Form, Zod, Lucide y Recharts. Antes de implementar se
  verificara la version estable y la compatibilidad de cada paquete.
- No se almacenaran numero de tarjeta, CVC, fecha de caducidad ni contrasenas
  legibles. Stripe seguira siendo el unico responsable de los datos de tarjeta.

## Objetivo
Cerrar primero el endurecimiento de sesiones, 2FA y privacidad con pruebas
completas, y solo despues construir un CRM administrativo seguro que permita
entender la actividad de los clientes sin almacenar datos innecesarios ni
enviar marketing sin una base valida.

## Flujo

### Seguridad: sesion de cliente renovable

```text
SECUENCIA (orden temporal abajo)
1. Cliente -> Web: inicia sesion con correo y contrasena.
2. Web -> API Auth: envia credenciales por HTTPS.
3. API Auth -> DB: valida usuario activo y hash Argon2.
4. API Auth -> DB: crea una sesion con token aleatorio hasheado, vencimiento
   por inactividad de 30 dias y limite absoluto de 90 dias.
5. API Auth -> Web: entrega cookies HttpOnly/Secure de acceso y renovacion.
6. Web -> API: usa el token de acceso sin exponerlo a JavaScript.
7. API -> DB: valida firma, sesion activa, usuario activo y vencimientos.
8. Web -> API Auth: cuando el acceso vence, solicita renovacion una sola vez.
9. API Auth -> DB: rota el token de renovacion y amplia la inactividad sin
   superar el limite absoluto.
10. API Auth -> Web: entrega cookies nuevas; el cliente no vuelve a escribir la
    contrasena.
11. Cliente -> API Auth: al cerrar sesion, revoca solo ese dispositivo.
12. API Auth -> DB: cambio de contrasena o desactivacion revoca todos los
    dispositivos del usuario.
```

```text
Peticion autenticada
        |
        v
Firma y formato validos? --no--> rechazar y limpiar acceso
        | si
        v
Existe la sesion y pertenece al usuario? --no--> rechazar
        | si
        v
Usuario activo y sesion no revocada? --no--> rechazar
        | si
        v
Acceso vigente? --si--> permitir peticion
        | no
        v
Existe renovacion valida? --no--> pedir inicio de sesion
        | si
        v
Supero 30 dias inactivo o 90 dias absolutos? --si--> pedir inicio de sesion
        | no
        v
Rotar renovacion + nuevo acceso --> repetir peticion una vez

Casos que NO invalidan la sesion:
- reiniciar Render, publicar codigo, cerrar navegador, cambiar de IP o Wi-Fi
- comprar, consultar pedidos o cambiar entre movil y ordenador
```

### Seguridad: acceso de Admin y Cocina con 2FA

```text
SECUENCIA (orden temporal abajo)
1. Personal -> API Auth: envia correo y contrasena.
2. API Auth -> DB: valida rol ADMIN/KITCHEN, usuario activo y Argon2.
3. API Auth -> Personal: si falta 2FA, entrega acceso temporal limitado para
   configurar el autenticador; no permite entrar al admin ni ver pedidos.
4. Personal -> API Auth: confirma el primer codigo TOTP.
5. API Auth -> DB: cifra el secreto TOTP con AES-256-GCM y habilita 2FA.
6. Personal -> API Auth: completa login con contrasena y codigo TOTP.
7. API Auth -> DB: crea sesion de turno con limite absoluto de 12 horas.
8. API Auth -> Admin/Cocina: permite solo las rutas autorizadas para su rol.
9. Admin -> API Staff: al desactivar, cambiar contrasena o reiniciar 2FA,
   revoca todas las sesiones del usuario afectado.
```

```text
Login de personal
      |
      v
Credenciales y rol validos? --no--> respuesta generica
      | si
      v
2FA configurado? --no--> sesion temporal solo para enrolamiento
      | si                         |
      v                            v
Codigo correcto? --no--> limitar intentos y rechazar
      | si                         |
      +----------------------------+
      v
Crear sesion de turno de 12 horas
      |
      v
Rol ADMIN? --si--> admin completo segun permisos
      | no
      v
Rol KITCHEN --> solo Cocina y acciones permitidas
```

### Privacidad y consentimiento comercial

```text
SECUENCIA (orden temporal abajo)
1. Cliente -> Web: decide por separado si acepta comunicaciones comerciales.
2. Web -> API: envia canales elegidos y version del texto de consentimiento.
3. API -> DB: registra fecha, origen, version y canales autorizados.
4. Cliente -> Cuenta: consulta o retira el permiso en cualquier momento.
5. API -> DB: conserva la retirada en una lista de exclusion.
6. Admin -> CRM: consulta segmentos, pero solo puede seleccionar para una
   campana a clientes con base valida para ese canal.
7. Sistema -> AuditLog: registra exportacion, cambio de consentimiento y otras
   acciones sensibles.
8. Cliente -> Privacidad: solicita acceso, rectificacion o eliminacion.
9. Admin -> Flujo RGPD: verifica identidad, conserva solo obligaciones legales
   y anonimiza o elimina el resto con trazabilidad.
```

```text
Admin quiere contactar a un cliente
        |
        v
Es mensaje operativo de un pedido? --si--> permitir por relacion contractual
        | no
        v
Es promocion comercial?
        | si
        v
Canal autorizado y sin oposicion? --no--> bloquear envio
        | si
        v
Contenido dentro de la finalidad informada? --no--> bloquear envio
        | si
        v
Enviar con opcion de baja + registrar resultado
```

### CRM administrativo

```text
SECUENCIA (orden temporal abajo)
1. Admin con 2FA -> Web Admin: abre Clientes.
2. Web Admin -> API CRM: solicita pagina, busqueda y filtros.
3. API CRM -> Guard/Roles: exige sesion ADMIN; KITCHEN y CLIENTE se rechazan.
4. API CRM -> DB: agrega pedidos entregados, cancelaciones, gasto, ultima
   compra, fidelidad y confianza de efectivo sin exponer datos innecesarios.
5. API CRM -> Web Admin: devuelve solo una pagina y metricas calculadas.
6. Admin -> Web Admin: abre ficha de un cliente.
7. Web Admin -> API CRM: solicita detalle e historial autorizado.
8. API CRM -> AuditLog: registra accesos sensibles y exportaciones.
9. Web Admin -> Admin: muestra estado calculado y motivo verificable.
10. Admin -> CRM: puede filtrar segmentos; no puede enviar campanas en la
    primera version.
```

```text
Solicitud de CRM
      |
      v
Sesion ADMIN + 2FA valida? --no--> 401/403 sin datos
      | si
      v
Filtros, pagina y limites validos? --no--> 400
      | si
      v
Consultar solo campos permitidos y metricas agregadas
      |
      v
Clasificar con reglas explicables:
- Nuevo: 0 pedidos entregados
- En desarrollo: 1-2 pedidos entregados
- Activo: compra reciente
- Frecuente: umbral configurable de compras recientes
- Inactivo: supera el periodo configurable sin comprar
      |
      v
Es exportacion? --si--> permiso reforzado + limite + AuditLog
      | no
      v
Mostrar pagina y ficha

Casos borde:
- sin pedidos: totales a cero, nunca error
- pedido cancelado: no suma gasto ni frecuencia
- cuenta desactivada: etiqueta visible y sin acciones comerciales
- consentimiento retirado: excluida de promociones
- datos eliminados/anonimizados: no reconstruir identidad desde pedidos
```

## Restricciones
- Todo se implementa y prueba primero en local. No hay push, despliegue ni
  migracion de produccion sin autorizacion escrita.
- Seguridad y CRM son fases independientes. El Gate de seguridad debe quedar
  aprobado antes de iniciar el CRM.
- Cada tarea termina en un diff pequeno y verificable. Por decision del
  propietario, T1-T9 se consolidan en un unico commit local despues del Gate;
  no se mezclan actualizaciones de dependencias ni el CRM en ese commit.
- No se modifican pedidos, importes, descuentos, Stripe, caja, cocina,
  impresion o reportes salvo el minimo necesario para leer metricas existentes.
- Las migraciones Prisma son aditivas y nuevas; nunca se reescribe una migracion
  aplicada ni se borran cuentas, contrasenas, pedidos o sesiones sin una regla
  explicita.
- El despliegue de una migracion exige `prisma migrate deploy` antes de arrancar
  la nueva API y un plan de rollback comprobado.
- Contraseñas: Argon2 existente. Nunca se registran, devuelven ni migran en
  texto claro.
- Sesiones: secretos aleatorios con `node:crypto`, hashes SHA-256 en base de
  datos, cookies `HttpOnly`, `Secure`, `SameSite` y rotacion de refresh token.
- TOTP: cifrado autenticado AES-256-GCM con clave externa en Render. La clave no
  entra en Git, logs, respuestas API ni variables `NEXT_PUBLIC_*`.
- No se ata una sesion a IP, Wi-Fi o user-agent: esos valores cambian y no son
  prueba suficiente de identidad. Podran registrarse de forma minimizada para
  auditoria si se justifica y con plazo de conservacion.
- CRM accesible solo a `ADMIN` con 2FA. `KITCHEN`, `CLIENTE` y usuarios
  anonimos reciben 403/401 y nunca datos parciales.
- Todas las busquedas, filtros, orden y paginacion del CRM se ejecutan en
  backend con limites estrictos. No se descarga la base completa al navegador.
- Las metricas monetarias usan centimos enteros. Los pedidos cancelados,
  fallidos o no entregados no cuentan como compras exitosas.
- El CRM no almacena tarjetas, CVC, contrasenas, datos de salud ni etiquetas
  subjetivas. Stripe mantiene los datos de pago.
- La segmentacion debe ser explicable, configurable y visible; nunca produce
  decisiones automaticas que perjudiquen al cliente.
- Consentimiento comercial separado del consentimiento legal obligatorio, sin
  casillas premarcadas, con retirada por canal y lista de exclusion.
- La politica de privacidad, el registro de actividades y los plazos de
  conservacion se actualizan antes de habilitar comunicaciones comerciales.
- No se agrega una libreria si la plataforma o una dependencia mantenida ya
  resuelve el problema. Se priorizan APIs nativas y componentes existentes.
- Una version nueva se considera utilizable solo si es estable, compatible con
  Node 22 y el resto del stack, sin advisory critico aplicable y con tests
  verdes. No se usa `npm audit fix --force` ni `latest` en `package.json`.
- En Windows se usan comandos `npm.cmd`. Las pruebas que necesitan PostgreSQL
  se ejecutaran contra una base temporal accesible sin exigir WSL al usuario.

## Fuera de alcance
- Enviar campañas masivas, newsletters, SMS o WhatsApp desde el CRM v1.
- Automatizaciones tipo "lleva 60 dias sin comprar, enviar cupon".
- Guardar tarjetas o crear una pasarela de pago propia.
- Comprar listas externas, enriquecer perfiles con terceros o rastrear clientes
  fuera de Mordida Tasty.
- Puntuar clientes con modelos opacos, IA o categorias despectivas.
- Exportacion masiva de clientes en el CRM v1.
- Acceso al CRM para Cocina, Reparto o Staff no administrador.
- Sustituir NestJS, Prisma, Next.js o PostgreSQL durante esta fase.
- Actualizar dependencias mayores no relacionadas solo por existir una version
  mas nueva. Esas migraciones requieren una spec y Gate propios.
- Ejecutar migraciones, limpiar datos o probar comunicaciones en produccion.

## Tareas

### Fase A: endurecimiento de seguridad

### T1: Fijar contrato y modelo de sesiones renovables
- **Hacer:** adaptar `AuthSession` para representar una sesion por dispositivo:
  hash de renovacion, usuario, rol/ambito, ultimo uso, vencimiento por
  inactividad, limite absoluto, revocacion y timestamps. Preparar migracion
  aditiva. Los JWT antiguos quedaran invalidados una sola vez al desplegar.
- **Archivos:** `apps/api/prisma/schema.prisma`, nueva carpeta en
  `apps/api/prisma/migrations/`, `apps/api/src/auth/session-policy.ts`.
- **Verify:** `npm.cmd run prisma:generate -w @mordida/api`,
  `npx.cmd prisma validate --schema apps/api/prisma/schema.prisma` y test
  unitario de limites 30/90 dias y 12 horas.

### T2: Crear tokens y cookies de acceso/renovacion
- **Hacer:** emitir JWT de acceso corto y refresh token opaco con formato
  `sessionId.secret`; guardar solo el hash del secreto. Definir cookies
  separadas para cliente y personal, rotacion y limpieza completa.
- **Archivos:** `apps/api/src/auth/auth-cookies.ts`,
  `apps/api/src/auth/auth.service.ts`, `apps/api/src/auth/auth.service.spec.ts`.
- **Verify:** tests de cookie segura, token hasheado, expiracion, rotacion y
  ausencia de secretos en respuestas; luego `npm.cmd run lint -w @mordida/api`.

### T3: Renovacion silenciosa y deteccion de reutilizacion
- **Hacer:** agregar endpoints de refresh para cliente y personal. Rotar el
  secreto en cada uso; si se reutiliza uno anterior para la misma sesion,
  revocar esa sesion. Limitar peticiones y exigir origen valido.
- **Archivos:** `apps/api/src/auth/auth.controller.ts`,
  `apps/api/src/admin/admin-auth.controller.ts`,
  `apps/api/src/common/guards/jwt-auth.guard.ts`.
- **Verify:** Supertest cubre refresh valido, vencido, revocado, reutilizado,
  usuario desactivado y origen invalido.

### T4: Reintento transparente en la web
- **Hacer:** centralizar en el cliente API un unico refresh en curso. Ante 401,
  renovar y repetir una sola vez; si falla, limpiar estado y llevar a login sin
  bucles. No renovar rutas publicas ni errores 403.
- **Archivos:** `apps/web/lib/api.ts`, nuevo test de cliente API y, solo si es
  necesario, `apps/web/components/auth-session-provider.tsx`.
- **Verify:** tests de concurrencia y bucle; Playwright mantiene una cuenta
  abierta al vencer el acceso y pide login al vencer/revocar el refresh.

### T5: Revocacion completa por eventos de seguridad
- **Hacer:** logout revoca solo la sesion actual. Reset/cambio de contrasena,
  desactivacion y reset 2FA revocan todas. Reautenticacion crea sesiones nuevas
  sin modificar cuenta, pedidos o contrasena fuera del cambio solicitado.
- **Archivos:** `apps/api/src/auth/auth.service.ts`,
  `apps/api/src/admin/staff.service.ts` y sus tests.
- **Verify:** Jest demuestra revocacion por cada evento, separacion entre dos
  dispositivos y conservacion de datos del usuario.

### T6: Cifrar secretos TOTP
- **Hacer:** crear servicio AES-256-GCM versionado usando `node:crypto`, validar
  `TOTP_ENCRYPTION_KEY` base64 de 32 bytes y cifrar nuevos secretos. Permitir
  lectura transitoria del formato antiguo y recifrarlo tras una validacion
  correcta para no romper 2FA existente.
- **Archivos:** nuevo `apps/api/src/auth/totp-crypto.service.ts`,
  `apps/api/src/config/env.ts`, `apps/api/src/auth/auth.service.ts`.
- **Verify:** tests de cifrado/descifrado, IV distinto, deteccion de alteracion,
  clave invalida, migracion de secreto antiguo y cero secretos en logs.

### T7: Exigir 2FA a Admin y Cocina
- **Hacer:** crear enrolamiento temporal con alcance unico para configurar 2FA.
  Sin confirmacion no se puede entrar al admin ni consultar pedidos. Mantener
  roles: Cocina solo accede a Cocina y acciones ya autorizadas.
- **Archivos:** `apps/api/src/admin/admin-auth.controller.ts`,
  `apps/api/src/common/guards/admin-two-factor.guard.ts`,
  `apps/web/app/admin/2fa/page.tsx`.
- **Verify:** E2E de ADMIN/KITCHEN con y sin 2FA, codigo incorrecto, throttle,
  token de enrolamiento intentando acceder a pedidos y reset administrativo.

### T8: Completar derechos RGPD antes del CRM
- **Hacer:** convertir solicitudes de eliminacion en flujo administrativo con
  estados, verificacion de identidad, resolucion, bloqueo/anominizacion de datos
  permitidos y conservacion separada de obligaciones contables. Definir plazo
  de conservacion y registrar la accion.
- **Archivos:** `apps/api/prisma/schema.prisma`, modulo `apps/api/src/privacy/`
  y migracion nueva.
- **Verify:** tests de solicitud duplicada, acceso no autorizado, resolucion,
  anonimizacion y preservacion de importes/pedidos legalmente requeridos. El
  criterio legal definitivo requiere revision profesional externa.

### T9: Gate de seguridad local
- **Hacer:** probar migraciones sobre PostgreSQL temporal, login cliente,
  renovacion, dos dispositivos, logout, reset, Admin, Cocina, 2FA, expiracion y
  rollback. Documentar variables y procedimiento Render sin desplegar.
- **Archivos:** `e2e/security-sessions.spec.ts`,
  `docs/VARIABLES_PRODUCCION.md`, `docs/MANUAL_RENDER_PASO_A_PASO.md`.
- **Verify:** `npm.cmd run lint`, `npm.cmd test`, `npm.cmd run build`, E2E
  desktop/mobile y `npm.cmd audit --workspaces --omit=dev`; informe con
  resultados y migraciones aplicadas en la base temporal.

### Fase B: preparacion tecnica del CRM

### T10: Auditar y actualizar dependencias compatibles
- **Hacer:** consultar registro oficial y changelogs. Actualizar React/ReactDOM,
  Next/eslint-config-next y Playwright en cambios separados, solo dentro de la
  misma version compatible o mediante migracion documentada. Confirmar
  TanStack Table, Zod, React Hook Form, Radix y Recharts antes de usarlos.
- **Archivos:** `apps/web/package.json`, `package-lock.json` y, solo si la guia
  oficial lo exige, configuracion afectada.
- **Verify:** por cada grupo: `npm.cmd ci`, lint, tests, build, E2E y
  `npm.cmd audit --workspaces --omit=dev`. Si falla, revertir solo ese grupo.

### T11: Modelo minimo de actividad y consentimiento
- **Hacer:** agregar `lastLoginAt` y consentimiento comercial por canal con
  fecha, version, origen y retirada. No guardar segmentos ni totales que puedan
  calcularse desde pedidos. Crear migracion aditiva.
- **Archivos:** `apps/api/prisma/schema.prisma`, migracion nueva,
  `apps/api/src/auth/auth.service.ts`.
- **Verify:** login actualiza `lastLoginAt` sin convertir cada peticion en una
  escritura; Prisma valido y tests de consentimiento/auditoria.

### T12: API paginada de clientes
- **Hacer:** crear listado ADMIN con busqueda, estado, ultima compra y
  paginacion server-side. Calcular entregados, cancelados, gasto y ticket medio
  con consultas agregadas; excluir contrasenas, secretos, tokens y direcciones.
- **Archivos:** nuevo modulo `apps/api/src/admin-customers/` con controlador,
  servicio y DTO.
- **Verify:** Jest/Supertest para filtros, limites, importes, sin pedidos,
  401/403 y ausencia de campos sensibles.

### T13: API de ficha y segmentacion explicable
- **Hacer:** devolver detalle permitido, historial paginado, fidelidad,
  confianza de efectivo y etiqueta calculada con el motivo. Umbrales en
  configuracion validada, no en el frontend.
- **Archivos:** `apps/api/src/admin-customers/admin-customers.service.ts`, DTO y
  configuracion/setting de segmentos.
- **Verify:** tests para Nuevo, En desarrollo, Activo, Frecuente e Inactivo;
  cancelados no suman y limites de fechas usan `APP_TIMEZONE`.

### T14: Navegacion y tabla CRM
- **Hacer:** agregar `Clientes` al admin y construir una superficie de trabajo
  compacta con TanStack Table: busqueda, filtros, orden y paginacion backend.
  No cargar toda la base en memoria ni crear tarjetas decorativas innecesarias.
- **Archivos:** navegacion admin, `apps/web/app/admin/clientes/page.tsx` y nuevo
  componente `components/admin-customers/customer-table.tsx`.
- **Verify:** Playwright desktop/tablet/mobile; textos no se solapan, teclado y
  lector de pantalla pueden operar tabla, filtros y paginacion.

### T15: Ficha administrativa del cliente
- **Hacer:** mostrar resumen, ultima actividad, pedidos, gasto, ticket medio,
  fidelidad, efectivo, consentimiento y motivos de segmentacion. Los datos
  personales se ocultan cuando no son necesarios y no hay acciones de campaña.
- **Archivos:** componente de detalle, tipos web y cliente API.
- **Verify:** Playwright abre/cierra ficha, pagina historial, representa cuenta
  sin pedidos, desactivada y anonimizada, sin errores de consola.

### T16: Preferencias comerciales del cliente
- **Hacer:** agregar controles separados por canal en registro/cuenta. La baja
  debe ser inmediata y prevalecer sobre preferencias anteriores. Mostrar texto
  claro, no casillas premarcadas.
- **Archivos:** `apps/web/app/auth/registro/page.tsx`,
  `apps/web/app/cuenta/page.tsx`, controlador de preferencias del cliente.
- **Verify:** E2E aceptar, rechazar y retirar; CRM refleja el cambio; un cliente
  sin consentimiento queda excluido de cualquier seleccion comercial futura.

### T17: Gate CRM local
- **Hacer:** datos de prueba anonimos para todos los segmentos; auditar RBAC,
  privacidad, rendimiento, accesibilidad y responsive. Probar que pedidos,
  checkout, cuenta, admin y Cocina siguen funcionando.
- **Archivos:** `e2e/admin-customers.spec.ts`, fixtures locales y documento de
  resultados.
- **Verify:** lint, 100% de tests existentes y nuevos, build, Playwright en
  escritorio/tablet/movil, consola limpia, imagenes cargadas y consulta de lista
  dentro del presupuesto de rendimiento definido con datos representativos.

## Done (validacion final)
- [ ] T1-T9 tienen diff revisado y un unico commit local consolidado.
- [ ] No hay push, despliegue ni migracion de produccion sin autorizacion.
- [ ] `npm.cmd run lint` pasa en API y web.
- [ ] `npm.cmd test` pasa sin omitir suites.
- [ ] `npm.cmd run build` pasa en API y web.
- [ ] Prisma valida y todas las migraciones suben/bajan segun el plan probado.
- [ ] Auditoria de produccion no reporta vulnerabilidades aplicables en
  dependencias de runtime; las de desarrollo quedan evaluadas y documentadas.
- [ ] Cliente permanece autenticado con renovacion transparente y solo vuelve a
  login tras revocacion, 30 dias inactivo o 90 dias absolutos.
- [ ] Reiniciar Render, desplegar o cambiar de red no cierra sesiones.
- [ ] Logout de un dispositivo no cierra otro; cambio de contrasena si cierra
  todos.
- [ ] Admin y Cocina no acceden sin 2FA y mantienen sus permisos separados.
- [ ] Secreto TOTP cifrado, versionado y nunca expuesto.
- [ ] Solicitudes RGPD tienen proceso verificable y auditable.
- [ ] CRM rechaza CLIENTE/KITCHEN y no devuelve campos sensibles.
- [ ] Totales CRM coinciden con pedidos entregados y centimos del backend.
- [ ] Segmentos son explicables, configurables y correctos en fechas limite.
- [ ] Consentimiento comercial es opcional, por canal y revocable.
- [ ] CRM funciona en escritorio, tablet y movil sin solapes ni errores de
  consola.
- [ ] Checkout, pagos, pedidos, promociones, Cocina, reportes e impresion no
  presentan regresiones.
