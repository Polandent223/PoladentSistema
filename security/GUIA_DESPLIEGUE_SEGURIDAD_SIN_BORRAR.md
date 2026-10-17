# POLADENT — Migración de seguridad de Firebase sin borrar historiales
**Estado: PREPARACIÓN EN RAMA, NO DESPLEGADO A FIREBASE.**

Proyecto de referencia: `poladent-5fa13`. La base de datos real contiene información sensible. **NO EJECUTAR `firebase deploy` contra producción** hasta completar esta lista y las pruebas.

## Por qué es urgente
El propietario mostró estas reglas efectivas:
```json
{"rules":{".read":"auth != null",".write":"auth != null","empleados":{".read":"auth != null",".write":"auth != null"},"marcaciones":{".read":"auth != null",".write":"auth != null"},"auditoria_ediciones":{".read":"auth != null",".write":"auth != null"}}}
```
Como la aplicación usa `signInAnonymously()` y la regla de raíz permite lectura/escritura a cualquier usuario autenticado, un cliente anónimo puede consultar y modificar nodos completos por fuera de los controles visuales.

**Precaución:** NO cambiar ahora la raíz a false en Firebase Console; bloquearía el sistema operativo. No publicar la plantilla de reglas de esta rama sin migrar la pantalla de empleado.

## Archivos preparados en esta rama de PR
- `functions/index.js`: `poladentBuscarFuncionario` (PIN con consultas restringidas, límite de intentos del lado del servidor y sesión efímera de 20 minutos), `poladentMarcarAsistencia` (validación de UID, aprobación de navegador, etapa, GPS, foto, transacciones y fecha de Venezuela).
- `functions/lib/core.js`: motor de validación independiente de Firebase.
- `apps/empleado-seguro.staging.js` y `empleado-seguro.staging.html`: pantalla nueva SIN acceso directo a empleados, nóminas o marcaciones.
- `security/realtime-database.after-migration.rules.json`: reglas que niegan acceso general a sesiones anónimas, requieren claim `poladent_admin` y registro activo del UID en `autorizaciones_admin`.
- `functions/scripts/acceso-administrador.js`: alta/revocación manual de autorización UID para operador de confianza.
- `firebase.staging.json`: configuración explícita para emuladores locales, no es el `firebase.json` de producción.
- `functions/test/core.test.js` y `functions/test/rules.emulator.cjs`: pruebas de jornada, geocerca, fotografía y matriz de acceso.

Las funciones de migración no eliminan ningún registro anterior de `marcaciones`; escriben solo la etapa pendiente mediante transacción que preserva las otras etapas.

## Etapas obligatorias ANTES del despliegue
### 0. Confirmación y alcance
- Confirmar que el proyecto Firebase correcto es `poladent-5fa13`.
- Verificar suscripción de Cloud Functions, región de base de datos, cuentas administrativas, número de empleados y jornadas activas.
- Confirmar con propietario un horario de corte y teléfonos de prueba; NO interrumpir jornadas en curso.

### 1. Respaldos verificables
- Firebase Console > Realtime Database > **Datos** > exportar **toda la base a JSON**. Comprobar integridad/tamaño y guardar copia fuera de GitHub.
- Firebase Console > Realtime Database > **Reglas** > copiar reglas existentes a un archivo privado de respaldo.
- Revisar si existen fotos en Firebase Storage y realizar respaldo separado en ese caso.
- Confirmar que se conservaron empleados, marcaciones, nóminas, auditorías, alertas, teléfonos, justificaciones, feriados y todas las rutas no previstas.
- **No usar función de restauración exacta** ni borrados; este procedimiento modifica control de accesos, no contenido histórico.

### 2. Admin verificado y App Check
- Identificar por Firebase Authentication el UID exacto de la cuenta de administrador. No confiar en registros editables de `usuarios_admin` con las reglas actuales.
- En un entorno de ejecución de confianza con credenciales de administrador de Google, usar:
  `node functions/scripts/acceso-administrador.js conceder <UID_REAL> <CORREO_REAL> CONFIRMO`.
  Nunca publicar claves de servicio ni compartirlas en este chat o en GitHub.
- Comprobar que se guardó `autorizaciones_admin/{uid}/activo:true` y que Auth custom claims incluye `poladent_admin:true`. La cuenta debe refrescar su token de acceso.
- Registrar la aplicación web en Firebase App Check con reCAPTCHA Enterprise (clave pública) y configurar `window.POLADENT_RECAPTCHA_ENTERPRISE_SITE_KEY` en el cliente de pruebas. La clave pública no es la clave privada.
- Asegurar que desactivar un administrador también revoque claim y registro de UID; no confiar únicamente en el campo `usuarios_admin/activo`. La operación manual de revocación existe en el script; automatización administrativa pendiente.

### 3. Pruebas fuera de producción
- Instalar Node.js 22, Firebase CLI y Java en equipo de desarrollo (si requerido por emulador).
- `cd functions && npm install && npm test && npm run check`.
- Arrancar emulador de Realtime Database:
  `firebase emulators:exec --config firebase.staging.json --only database "cd functions && npm run test:rules" --project demo-poladent-security`
- Ejecutar pruebas integración de Cloud Functions en emuladores de Auth/Functions/RTDB, con datos de prueba ficticios.
- Confirmar como mínimo: un anónimo no lee empleados ni nóminas, no modifica historiales, un admin autorizado accede, un UID revocado no accede, un empleado aprobado marca entrada/almuerzo/regreso/salida, otro dispositivo no suplanta, reintentos no duplican la etapa, las fotos y GPS son obligatorios donde correspondan, un empleado archivado no puede marcar.
- IMPORTANTE: las pruebas unitarias de funciones no sustituyen las pruebas integrales con el emulador.

### 4. Corte controlado, después de pasar TODAS las pruebas
1. Confirmar respaldo reciente y exportación de reglas, sin cambios de historia.
2. Desplegar **solo Cloud Functions** con configuración y proyecto explícitos. La app existente sigue operando con las reglas antiguas mientras se realiza la transición.
3. Probar la pantalla `empleado-seguro.staging.html` con App Check real y cuentas de prueba. Resolver los errores de Firebase/Cloud Functions antes de continuar.
4. Reemplazar la página pública de empleados por la nueva versión segura. Confirmar que los teléfonos abren realmente la nueva versión y no una caché antigua.
5. Verificar acceso de administradores con UID+claim y sus pantallas.
6. **Solo después**, desplegar reglas nuevas de `security/realtime-database.after-migration.rules.json` con el archivo de configuración especificado. Monitorear errores de acceso y marcaciones.
7. Auditar todos los flujos administrativos (usuarios, horarios, nómina, fotografías, correcciones, reportes, respaldo). El sistema actual utiliza varias rutas; si alguna carece de regla concreta, ampliar y probar la plantilla antes del corte.
8. Registrar una jornada real de prueba y comparar el historial anterior con el nuevo para asegurar que no se sobrescribió nada.
9. Conservar copia de las reglas y código anterior para revertir acceso sin restaurar datos ni eliminar historiales.

## Limitaciones conocidas (no certificar seguridad final todavía)
- El backend no ha sido desplegado ni probado contra Firebase real.
- La plantilla de reglas de esta rama es de **poscorte**. Puede romper módulos heredados o las cuentas `gerente` si no se migra y prueba el inventario completo de permisos administrativos.
- La verificación de GPS y una foto no constituye reconocimiento facial ni detección infalible de presencia.
- Un UUID de navegador y Firebase Auth anónimo no identifican hardware de forma infalsificable. App Check ayuda a frenar abuso, pero no garantiza unicidad física del teléfono.
- Los PIN actuales están guardados en texto legible en `empleados`. Este corte impide exponerlos a sesiones anónimas mediante lecturas directas; un programa posterior deberá migrar PIN a hashes, de forma compatible y sin borrar historiales.
- No se deben dejar claves privadas de Firebase en GitHub. No hay service accounts en esta rama.
- El frontend todavía debe migrar todas las lecturas que haga el usuario anónimo a llamadas de servidor; el panel administrador se mantiene cliente pero protegido mediante claims y reglas.
- No hay pruebas de reglas en producción ni garantía de que todos los usuarios administradores estén provisionados.

## Retroceso seguro
Si después del corte falla una ruta, **revertir las reglas al archivo respaldado** mientras se corrige y se investiga, sin restaurar/borrar la base. Mantener las copias protegidas y acelerar la corrección para no reabrir el acceso anónimo innecesariamente. Nunca restaurar un JSON de base completa encima del histórico actual para solucionar un fallo de permisos.

**Prioridad:** mantener integridad de empleados, historiales, pagos, marcaciones y auditorías sobre la velocidad del despliegue.
