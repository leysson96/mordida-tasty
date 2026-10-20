# Privacidad y retencion de datos

## Alcance

Este documento describe el criterio tecnico aplicado por Mordida Tasty cuando
se aprueba una solicitud de supresion. No sustituye la revision de un asesor
juridico o fiscal antes de habilitar el flujo en produccion.

## Datos que se suprimen o anonimizan

Al completar una solicitud verificada, el sistema:

- elimina direcciones guardadas, tokens de verificacion y recuperacion,
  sesiones, datos de fidelidad y confianza para pagos en efectivo;
- desactiva la cuenta y sustituye nombre, correo, telefono y credenciales por
  valores anonimos no reutilizables;
- desvincula los pedidos de la cuenta y elimina de ellos los datos de contacto,
  direccion y notas de entrega;
- conserva el estado, los importes, las lineas de producto y los registros de
  pago necesarios para contabilidad, fiscalidad, incidencias y auditoria;
- registra la verificacion, la decision y el administrador responsable en el
  historial de auditoria.

## Plazo de conservacion

Como criterio operativo provisional, los justificantes y registros economicos
se conservaran durante seis anos desde el ultimo asiento o documento asociado.
Este plazo toma como referencia el articulo 30 del Codigo de Comercio. El plazo
tributario general de prescripcion es de cuatro anos conforme al articulo 66 de
la Ley General Tributaria; se aplica el plazo comercial mas amplio cuando ambos
resulten relevantes.

Transcurrido el plazo aplicable, debe ejecutarse una revision documentada para
eliminar o anonimizar los datos restantes que ya no sean necesarios. Una
obligacion legal, reclamacion o investigacion abierta puede exigir conservar un
registro concreto durante mas tiempo.

## Reglas de operacion

- Una solicitud publica no confirma si existe una cuenta y siempre devuelve
  una respuesta generica.
- La identidad debe verificarse antes de resolver la solicitud y el metodo de
  verificacion se registra en una nota interna.
- Solo un administrador con sesion valida y 2FA puede consultar o resolver
  solicitudes.
- Los datos anonimizados no deben reconstruirse desde pedidos ni copias de
  trabajo.
- Antes del despliegue se revisaran este plazo, la politica de privacidad y el
  registro de actividades con asesoramiento profesional externo.

## Referencias oficiales

- Codigo de Comercio, articulo 30: https://www.boe.es/buscar/act.php?id=BOE-A-1885-6627
- Ley General Tributaria, articulo 66: https://www.boe.es/buscar/act.php?id=BOE-A-2003-23186
- AEPD, principios de minimizacion y limitacion del plazo de conservacion:
  https://www.aepd.es/derechos-y-deberes/cumple-tus-deberes/principios
- AEPD, derecho de supresion:
  https://www.aepd.es/preguntas-frecuentes/1-tus-derechos/2-tus-derechos-de-proteccion-de-datos/FAQ-0111-que-es-el-derecho-de-supresion-derecho-al-olvido
