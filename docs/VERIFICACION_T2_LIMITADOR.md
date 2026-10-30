# T2: liberacion de memoria del limitador

Fecha: 2026-10-29. Solo local. Sin commit, push, despliegue o cambio de plan.

## Solucion

Actualizacion acotada de @nestjs/throttler 6.5.0 (lock anterior) a 6.7.1, fijada exactamente en apps/api/package.json y package-lock.json. Es la version publicada consultada en npm para esta tarea; compatible con Nest 11 y Node 22.19.0. Requiere Node ^20.19.0, ^22.12.0 o >=24; no usar Node 22.0 para esta version.

No se implemento un limitador propio ni se modifico node_modules manualmente. No cambia app.module.ts ni ningun decorador de limite/exencion de los controladores. El limite general sigue siendo 120 por 60000 ms; los limites especificos de autenticacion y la exencion del webhook permanecen intactos.

La version oficial sustituye timers por hit por timestamps, limpia registros inactivos con un barrido y conserva entradas cuyo bloqueo o hits siguen vigentes. El barrido normal es de 60000 ms: la liberacion no es inmediata al vencer el ultimo hit, sino al siguiente barrido elegible. La prueba aislada acelera solamente ese barrido en una subclase de ensayo, sin alterar la configuracion de la aplicacion.

Fuentes consultadas:
- https://raw.githubusercontent.com/nestjs/throttler/v6.7.1/src/throttler.service.ts
- https://docs.nestjs.com/security/rate-limiting
- npm view @nestjs/throttler version / peerDependencies / engines / dist.integrity

## Evidencias

Antes: dos tandas de 1000 identidades dejaban 1000 y luego 2000 entradas caducadas en el Map.

Despues, node scripts/audit-rate-limit-memory.cjs:

```json
{"round":1,"keysAfterExpiration":0,"version":"6.7.1"}
{"round":2,"keysAfterExpiration":0,"version":"6.7.1"}
```

El script resuelve la dependencia desde apps/api/package.json, como la API, y falla si quedan entradas tras la expiracion. No realiza peticiones a produccion ni consultas a BD.

Pruebas nuevas:

- Dos tandas de identidades con limpieza y un solo timer.
- Veinte solicitudes simultaneas: cinco aceptadas y las restantes bloqueadas.
- Bloqueos mas largos que el TTL sobreviven al barrido.
- Hits individuales caducan en ventana deslizante.
- Un hit tardio mantiene su entrada aunque haya vencido la ventana inicial.
- Desbloquear una identidad no interrumpe la expiracion de otra.
- Configuraciones independientes no se mezclan.
- Cierre de aplicacion libera timer y registros.
- HTTP real local: sexto intento de login devuelve 429 y Retry-After, sin bloquear health de otra ruta.
- HTTP real local: limite general 120 y endpoint webhook exento.

La prueba HTTP monta un controlador de ensayo con la configuracion equivalente; no ejecuta contrasenas ni pagos reales. Las suites existentes de auth, guards y controladores tambien se ejecutaron.

## Resultados

- npm.cmd run test -w @mordida/api -- --runInBand: 30 suites, 297 tests pasan.
- npm.cmd run lint -w @mordida/api: pasa.
- npm.cmd run build -w @mordida/api: pasa.
- npm.cmd ls @nestjs/throttler -w @mordida/api: version 6.7.1.
- git diff --check: sin errores de whitespace.

El primer ensayo HTTP requeria tipos de supertest ausentes; se reemplazo por fetch nativo contra Nest en un puerto efimero, sin agregar dependencias. npm tambien elimino metadatos libc de Sharp al regenerar el lock; se restauraron para dejar solo cambios del limitador.

## Alcance y pendientes

Se corrige la retencion logica reproducida de la API; no se mide aun RSS bajo trafico real en Render. No afirmar que esta correccion resuelve el OOM del servicio web, que es otro proceso. El almacenamiento sigue siendo por instancia, como antes; no se introdujo Redis ni coordinacion multiinstancia.

T1 sigue pendiente de despliegue junto con estos cambios; T3 aun no implementada. Rollback futuro: restaurar manifest/lock del limitador y reinstalar con npm ci, sin migraciones de BD. Eso reintroduciria la retencion antigua y solo debe usarse si fuera necesario por una regresion confirmada.
