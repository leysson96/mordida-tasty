# Auditoria de identidad de clientes

Fecha: 23 de octubre de 2026
Rama: `fix/search-brand-identity`

## Causa observada

La tabla anterior mostraba el nombre, pero ocultaba los identificadores que permiten distinguir cuentas. Dos filas con el mismo nombre parecian duplicadas aunque cada una pudiera tener un `User.id` y un correo diferentes. Ademas, los pedidos realizados sin cuenta (`Order.userId = null`) no aparecian en el CRM porque la consulta solo listaba usuarios registrados.

Tambien existia un riesgo de atribucion: una cookie de cliente invalida podia terminar tratandose como ausencia de sesion. El pedido podia continuar como invitado en vez de pedir al cliente que iniciara sesion de nuevo.

## Criterio de identidad aplicado

- Cuenta registrada: `User.id` es la identidad principal y estable.
- Correo: se normaliza a minusculas y sigue siendo unico para cuentas registradas.
- Telefono: se normaliza a E.164 para comparar formatos equivalentes. No es unico porque puede ser compartido.
- Codigo postal: es informativo y nunca se usa por si solo para identificar a una persona.
- Comprador invitado: se presenta en una vista separada, agrupado de forma conservadora por correo y telefono normalizados.
- Nombre: es solo un dato visible; dos personas pueden tener el mismo nombre y no se fusionan.

## Cambios realizados

- Se centralizo la normalizacion y el enmascarado de correo, telefono y codigo postal.
- Se incorporo `libphonenumber-js` 1.13.15 como dependencia directa y fijada en el lockfile.
- El alta, las direcciones y los pedidos nuevos guardan identificadores normalizados.
- `POST /orders` diferencia a un invitado real de una sesion cliente invalida. Una credencial invalida recibe `401` y no degrada el pedido a invitado.
- El cliente web intenta renovar la sesion una sola vez antes de reenviar el mismo pedido con la misma clave de idempotencia.
- El CRM muestra ID corto, correo y telefono enmascarados, codigo postal y estado de verificacion.
- Registrados e invitados se muestran en pestañas separadas.
- Los pedidos invitados se agregan mediante Prisma y se consolidan por los identificadores normalizados, sin SQL manual.

## Impacto sobre datos

- No se agrega ninguna migracion de base de datos.
- No se borra, fusiona ni reasigna ninguna cuenta o pedido historico.
- No se modifican pagos, precios, descuentos, promociones, fidelidad ni sesiones existentes.
- La normalizacion se aplica a escrituras nuevas. El listado normaliza en memoria los datos historicos solo para presentarlos, sin guardarlos de nuevo.

## Privacidad

- La tabla administrativa recibe correo y telefono ya enmascarados desde la API.
- Los datos completos siguen limitados al detalle administrativo protegido.
- No se agregaron correos, telefonos, direcciones ni codigos postales completos a los logs.

## Verificacion local

La comprobacion final debe incluir:

```text
npm run lint
npm test
npm run build
npm run test:e2e
npm audit --omit=dev
```

Resultado local final:

- `lint`: correcto en API y web.
- tests API: 28 suites y 287 tests aprobados.
- build: API NestJS y web Next.js compiladas para produccion.
- E2E: 57 pruebas aprobadas y 1 omitida de forma intencional; cubre escritorio, tableta y movil.
- dependencias de produccion: 0 vulnerabilidades conocidas.
- `git diff --check`: sin errores de espacios.

La primera ejecucion E2E tuvo un timeout aislado en el checkout movil en efectivo durante la carga paralela del servidor de desarrollo. El caso paso al repetirlo solo y la suite completa posterior termino verde, por lo que no se reprodujo como fallo funcional.

Se verifican expresamente:

- dos cuentas con el mismo nombre conservan IDs y contactos distinguibles;
- formatos equivalentes de correo y telefono de un invitado se agrupan una sola vez;
- registrados e invitados permanecen separados;
- la tabla no expone datos de contacto completos;
- una cookie invalida no crea un pedido invitado;
- la vista funciona en escritorio, tableta y movil sin desbordamiento.

## Limitacion del entorno local

Este equipo no dispone de PostgreSQL local, Docker ni WSL. La consulta utiliza la API tipada de Prisma y queda cubierta por tests unitarios, compilacion y E2E con API simulada. Despues de autorizar el despliegue debe hacerse una comprobacion de solo lectura del CRM en produccion antes de cualquier correccion manual de datos.
