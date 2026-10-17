# POLADENT — Protección de Firebase sin eliminación de historial
Fecha de revisión: 17 de octubre de 2026
Proyecto identificado en código: `poladent-5fa13` (Realtime Database).

## Compromiso de preservación
En esta revisión NO se ha eliminado ni reescrito ningún dato de Firebase: empleados, asistencia, nómina, fotografías, GPS, dispositivos ni auditorías. Únicamente se modificó código del repositorio y se añadió esta documentación. **No se publicaron reglas nuevas en el servidor Firebase.**

## Diagnóstico verificado en el código
1. La página `empleado.html` usa `signInAnonymously()`.
2. El cliente lee `empleados` completo, incluidas fichas con `pin`, para una caché de búsqueda, y dispone de la consulta `orderByChild('pin')`.
3. El cliente escribe directamente en `marcaciones/{empleadoId}/{fecha}/{etapa}`, `dispositivos_marcacion` y `alertas_seguridad`.
4. El administrador accede con correo y contraseña; el módulo de roles `apps/modules/seguridad-operativa.js` antes concedía perfil administrador ante un fallo de lectura de permisos. La caída por error ya no concede ese permiso visual.
5. Las reglas REALES de Realtime Database NO figuran en GitHub y NO fueron recuperadas del proyecto remoto; no puede afirmarse que la base esté públicamente abierta o ya cerrada.
6. Un UUID en localStorage y el UID anónimo de navegador NO identifican un teléfono de manera física o infalsificable.

## Qué está preparado, pero NO debe publicarse todavía
`security/firebase-rules.STAGING-DO-NOT-DEPLOY.json` es un **borrador restrictivo para arquitectura futura**. Niega escrituras directas desde navegadores y presupone usuarios administradores con custom claim `poladent_admin=true`, fijado exclusivamente por Admin SDK. **Si se despliega ahora se interrumpirán las marcaciones y acciones administrativas existentes**. No es una configuración lista para producción ni sustituye las reglas vigentes.

## Orden obligatorio para blindar Firebase
1. **Leer y exportar las reglas vigentes** desde Firebase Console (Realtime Database > Rules), sin guardar tokens o contraseñas en GitHub.
2. **Respaldo verificado de la base completa** y exportación de reglas actuales, incluyendo nodos históricos, nómina, auditoría y fotografías. No continuar si faltan rutas o falla el respaldo.
3. Documentar en un entorno de prueba la matriz de permiso por ruta y función, con usuarios anónimos, administradores, gerentes y empleados.
4. Vincular administradores a **UID y custom claims** en backend, no a un correo sin registro, ni al rol predeterminado `administrador` en JavaScript.
5. Mover el reconocimiento de PIN, búsqueda de empleados y escrituras de asistencia a un servicio autenticado y validado en servidor (Cloud Functions / backend confiable). Nunca devolver el directorio completo o PIN a una sesión anónima. Separar información pública y privada.
6. Exigir autorización por empleado/dispositivo **desde el servidor** al marcar; validar etapa, jornada, sede y política; proteger contra reintentos y concurrencia. La fotografía/GPS son evidencia, no identidad irrefutable.
7. Migrar rutas gradualmente, sin borrar ni mover el historial previo. Conservar compatibilidad de informes y nóminas.
8. En **Firebase Emulator**, ejecutar la matriz siguiente y cualquier regresión del sistema.
9. Solo entonces aplicar reglas precisas por ruta; monitorear errores de acceso y tener copia de las reglas anteriores para reversión, sin restaurar destructivamente la base.

## Matriz mínima de pruebas
| Actor | Acción | Resultado esperado |
|---|---|---|
| No autenticado | Leer raíz / empleados / nómina / fotos / alertas | Denegar |
| Sesión anónima sin autorización | Leer directorio de empleados con PIN | Denegar |
| Sesión anónima | Escribir nómina, marcaciones ajenas, permisos, aprobación de dispositivos | Denegar |
| Empleado identificado | Marcar etapa propia válida en sede permitida con dispositivo autorizado | Permitir por backend |
| Empleado | Repetir una etapa o marcar por otro funcionario | Denegar |
| Administrador reconocido por backend | Consultar datos autorizados | Permitir |
| Usuario administrativo desactivado | Consultar/modificar datos | Denegar |
| Usuario sin rol o con fallo de lectura | Ejecutar operaciones administrativas | Denegar |
| Intento de borrar historia desde cliente | Eliminar marcaciones / recibos / auditoría | Denegar |
| Operación de corrección autorizada | Ajustar marcación con auditoría y sin pérdida de original | Permitir por flujo confiable |
| Reintento y concurrencia | Marcar dos veces etapa / utilizar mismo teléfono por dos empleados | Rechazar una operación |

## Hallazgos pendientes de resolver antes de cierre
- El fallback histórico asigna el rol `administrador` a cuentas de correo/contraseña sin perfil registrado: su eliminación requiere primero inventariar y vincular el administrador legítimo para NO bloquearlo.
- No es posible comprobar permisos de backend desde Github: las reglas publicadas, permisos de Auth, y acceso a datos requieren conexión directa a Firebase.
- La comprobación sin autenticación al endpoint REST `/.json?shallow=true` no fue accesible desde la infraestructura disponible, por lo que no se concluye si la base es pública.

## Enlaces oficiales
- https://firebase.google.com/docs/database/security
- https://firebase.google.com/docs/rules/rules-and-auth

**Estado operativo:** cambios de interfaz realizados; seguridad de la base REAL AÚN NO CERTIFICADA. NO BORRAR HISTORIALES.
