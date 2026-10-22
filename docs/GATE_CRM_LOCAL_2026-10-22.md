# Gate CRM local - 2026-10-22

## Alcance

Validacion local de T17 sobre `wip/carta-cliente-v2`. No se uso la base de
datos de produccion, no se hizo push, despliegue ni integracion a `main`.

## Resultado

**PASA** para el alcance local verificable.

| Area            | Resultado | Evidencia                                                                                                                                                 |
| --------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Acceso          | PASA      | Anonimo recibe 401; CLIENTE y KITCHEN reciben 403; ADMIN con 2FA accede.                                                                                  |
| Privacidad      | PASA      | La lista no muestra email ni telefono; la ficha los oculta hasta accion explicita; una cuenta anonimizada no permite reconstruirlos.                      |
| Metricas        | PASA      | Solo pedidos `DELIVERED` cuentan para pedidos, gasto, ticket medio y ultima compra. Cancelados se muestran aparte.                                        |
| Segmentos       | PASA      | Casos `NEW`, `DEVELOPING`, `ACTIVE`, `FREQUENT` e `INACTIVE`, con motivo explicable.                                                                      |
| Consentimientos | PASA      | Email autorizado, SMS retirado y WhatsApp no registrado se representan por separado. La retirada/activacion de preferencias conserva su auditoria en API. |
| Paginacion      | PASA      | Lista y ficha paginadas en servidor; limite API de 100; escenario E2E con 1.500 clientes y pagina de 25.                                                  |
| Rendimiento UI  | PASA      | Recarga de lista paginada dentro del presupuesto definido de 2.000 ms en el runner local.                                                                 |
| Accesibilidad   | PASA      | Landmarks, nombres accesibles, controles del dialogo, foco de Radix y ausencia de IDs duplicados en el recorrido CRM.                                     |
| Responsive      | PASA      | Escritorio 1440 px, tablet 820 px y movil Pixel 5 sin overflow horizontal del documento.                                                                  |
| Consola CRM     | PASA      | Sin errores `console.error` ni `pageerror` en lista y ficha.                                                                                              |
| Imagenes        | PASA      | El smoke completo comprueba que las imagenes renderizadas terminan cargadas (`naturalWidth > 0`).                                                         |
| Regresion       | PASA      | Carta, promociones, carrito, checkout efectivo/tarjeta, seguimiento, registro, cuenta, sesiones, admin, reportes y carga de imagen.                       |

## Pruebas ejecutadas

- `npm.cmd run lint -w @mordida/api`: PASA.
- `npm.cmd run lint -w @mordida/web`: PASA.
- `npm.cmd test -w @mordida/api -- --runInBand`: 27 suites, 262 pruebas, todas pasan.
- `npm.cmd run test:e2e`: 53 pasan, 1 omitida de forma intencional. La omitida es la duplicacion movil del caso tablet, que se ejecuta una vez desde el proyecto desktop.
- `npm.cmd run prisma:generate`: PASA con Prisma Client 6.19.3.
- `npm.cmd run build -w @mordida/api`: PASA.
- `npm.cmd run build -w @mordida/web`: PASA; `/admin/clientes` se genera correctamente.
- `npm.cmd audit --omit=dev --workspaces`: 0 vulnerabilidades.
- `git diff --check`: PASA; solo avisos de normalizacion LF/CRLF de Windows.

## Capturas

- `audit-artifacts/t17-crm-desktop-detail.png`
- `audit-artifacts/t17-crm-desktop-tablet-detail.png`
- `audit-artifacts/t17-crm-mobile-detail.png`

## Ajustes del gate

- Se agrego el spec CRM con fixtures anonimos y representativos.
- Se actualizaron fixtures E2E antiguos para responder a
  `GET /customers/commercial-consents`, incorporado en T16.
- Se hizo explicito el selector del campo de email de registro porque ahora
  existe tambien un checkbox comercial llamado Email.
- La auditoria final retiro email y telefono de la respuesta del listado CRM;
  la busqueda sigue siendo server-side y el contacto solo se entrega en la
  ficha individual protegida.
- La prueba de recarga valida la segunda solicitud y su resultado, sin depender
  de observar un texto transitorio de un solo frame.

## Limite conocido

El presupuesto de 2.000 ms mide la solicitud paginada y el render del frontend
con 1.500 registros representativos simulados. No es una prueba de latencia de
PostgreSQL real: no hay PostgreSQL local disponible y no se debe ejecutar carga
contra produccion. La forma y el numero acotado de consultas quedan cubiertos
por las pruebas unitarias del servicio.
