# Norma de documentacion y trazabilidad

Documentado: 2026-11-18 21:36:44 +01:00 (Europe/Madrid).
Ultima actualizacion: 2026-11-18 21:36:44 +01:00 (Europe/Madrid).
Verificacion: reloj local consultado en ese momento; no se ejecuto auditoria
de codigo, dependencias o produccion para establecer esta norma.
Estado: norma acordada por el usuario; documento local, sin commit ni push.

## Aplicacion obligatoria desde ahora

Toda documentacion nueva o modificada incluye fecha y hora. Se aplica a
auditorias, planes, informes de pruebas, parches, cambios de lenguaje,
framework, librerias y dependencias, y publicaciones.

Usar `AAAA-MM-DD HH:mm:ss +/-HH:mm (Europe/Madrid)`, obteniendo hora y offset
del reloj en cada ejecucion. No fijar +01:00 para todo el ano: respetar horario
de verano. Registrar la zona real si se usa otra, sin cambiar solo la etiqueta.

## Cabecera minima

```text
Documentado: <fecha y hora de redaccion, offset y zona>
Ultima actualizacion: <fecha y hora de esta edicion, offset y zona>
Auditoria/verificacion realizada: <inicio y fin, o no ejecutada>
Base revisada: <rama, SHA y presencia de cambios locales relevantes>
Estado: <plan / en curso / probado local / commit / publicado / desplegado>
Alcance: <que se reviso y que no se verifico>
```

La fecha de un nombre de archivo no sustituye a esta cabecera. Una actualizacion
de texto no cambia la fecha de la auditoria o de las pruebas anteriores.
Si se reutiliza evidencia anterior, conservar su fecha y referenciarla.

## Registro por accion

| Fecha y hora con zona | Accion | Evidencia | Resultado y limites |
| --- | --- | --- | --- |
| <momento real> | Auditoria / cambio / prueba / publicacion | Comando, archivo, SHA o fuente | Resultado concreto; pendiente si no se verifico |

Para cada parche o actualizacion registrar motivo, versiones antes/despues,
compatibilidad, archivos afectados, pruebas y codigos de salida, riesgos
pendientes y forma de revertir. No prometer ausencia absoluta de errores.
Fechar las consultas a registros/avisos: sus resultados pueden cambiar.

## Publicacion y produccion

- Fechar commit y push cuando ocurran; incluir SHA y rama destino.
- Registrar despliegue por separado y quien lo comprobo. Si solo el usuario
  lo confirma, indicarlo; si no informa hora exacta, no inventarla.
- No presentar incidentes antiguos como actuales. Una caida requiere evidencia
  actual o un reporte del usuario, con el momento conocido y su fuente.
- No heredar autorizaciones de commits/despliegues anteriores.

## Historia y correcciones

- No rellenar retroactivamente horas desconocidas. Usar "hora no registrada".
- Conservar evidencia historica identificada como tal; distinguirla del resumen
  vigente. Fechar la correccion y explicar que afirmacion sustituye.
- Mantener el indice actualizado con tareas activas, pausadas y terminadas.
  Usar identificadores completos (por ejemplo Seguridad-S5 o Estabilidad-T7).
