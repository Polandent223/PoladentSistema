# POLADENT — Control de teléfonos por funcionario (17-10-2026)

## Estado
La protección del navegador y el panel de aprobación están incorporados en GitHub.
**El requisito de teléfono aprobado está DESACTIVADO por defecto para no bloquear la nómina de empleados existentes.**
La regla de un teléfono por funcionario durante la misma jornada continúa activa.

## Puesta en marcha segura
1. Ingresar como administrador a **Configuración → Seguridad de marcación → Registro y autorización de teléfonos**.
2. Durante el modo de preparación, cada funcionario marca normalmente y se envía una solicitud de registro con su identificador de navegador y su UID anónimo de Firebase Auth.
3. Comprobar físicamente la identidad del funcionario antes de aprobar la solicitud. Las aprobaciones y revocaciones requieren nuevamente la contraseña del administrador y quedan auditadas.
4. Aprobar todas las solicitudes válidas y verificar que no se haya registrado el mismo navegador para varias personas.
5. SOLO tras completar el enrolamiento y revisar las reglas remotas de Firebase, activar **Exigir teléfono autorizado por el administrador** y pulsar Guardar seguridad.
6. Probar entrada, salida almuerzo, regreso almuerzo, salida, segundo PIN en el mismo navegador, otro navegador, borrado de datos de navegador, y denegación de escritura directa.

## Rutas nuevas Firebase
- `solicitudes_dispositivo/{empleadoId}/{dispositivoId}`: solicitudes con UID de autenticación, agente, estado y fecha.
- `dispositivos_empleados/{empleadoId}`: dispositivo autorizado y UID asociados al empleado.
- `auditoria_dispositivos/{id}`: aprobación, rechazo y revocación con identidad del administrador.

Las copias de seguridad ahora incluyen estas tres rutas. La eliminación completa de un funcionario elimina su registro y solicitudes, pero mantiene las auditorías administrativas.

## Reglas Firebase: validación pendiente, NO desplegada
El repositorio no incluye la configuración remota real de Realtime Database Security Rules.
Antes de activar el bloqueo obligatorio, revisar las reglas vigentes sin sustituirlas a ciegas:
- Los usuarios anónimos NO deben poder crear, editar o borrar `dispositivos_empleados`, `auditoria_dispositivos`, ni la configuración de seguridad.
- Una solicitud en `solicitudes_dispositivo` debe poder crearse solo con `auth.uid` igual al `authUid` registrado; impedir que un usuario anónimo la autoapruebe.
- Solo cuentas administrativas autenticadas y autorizadas pueden aprobar o revocar teléfonos. No basta con ocultar los botones en JavaScript.
- Las escrituras de marcaciones deben verificar en el servidor la identidad/autorización del funcionario y las políticas activas. Firebase Auth anónimo y un PIN visible en el frontend no son una autenticación robusta por sí solos.
- Confirmar que los historiales, las fotos y los datos personales no se puedan leer o modificar desde un cliente no autorizado.
- Para una garantía fuerte contra manipulación deliberada y llamadas directas a Firebase, trasladar la validación de asistencia a una función de servidor confiable (p. ej., Cloud Functions), con una credencial por dispositivo gestionada/validada por el backend. No confiar únicamente en UUID de localStorage ni en el código del navegador.

## Alcance y limitaciones
- El control exige coincidencia del identificador del navegador y del UID de Firebase Auth asociado al teléfono aprobado. Limpiar datos normalmente cambia ambos y obliga a una nueva aprobación; cambiar de navegador también.
- No identifica físicamente el hardware; un atacante técnico con acceso al dispositivo o las credenciales puede manipular el cliente.
- La fotografía obligatoria de entrada, GPS, nóminas y etapas de marcación se conservan.
- Este cambio no fue probado con la base Firebase de producción ni implica que se hayan actualizado las reglas de seguridad remotas.
