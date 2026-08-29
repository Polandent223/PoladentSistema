# Poladent Sistema de Asistencia

Versión estable preparada para GitHub Pages: **Fase 19.17**.

## Publicación

La raíz del repositorio debe conservar:

- `index.html`
- `empleado.html`
- `.nojekyll`
- `firebase/`
- `apps/`
- `css/`
- `img/`
- `sw.js`

No cambies los nombres ni muevas `firebase/config.js`.

En GitHub Pages publica desde la rama principal y la carpeta `/ (root)`.

## Después de subir

1. Espera a que GitHub Pages termine el deployment.
2. Abre la página publicada.
3. Haz una actualización fuerte del navegador una vez.
4. Prueba Administrador.
5. Prueba `empleado.html` desde un teléfono.
6. Verifica una marcación completa antes de usarlo normalmente.

## Datos

Esta revisión no migra ni elimina información de Firebase. Los historiales, empleados,
marcaciones, nómina, GPS y auditorías siguen usando las rutas existentes.

## Seguridad importante

La configuración web de Firebase puede estar en un repositorio público; la protección real
de los datos depende de **Firebase Authentication y Realtime Database Security Rules**.
Las reglas remotas de Firebase no forman parte de este paquete y deben revisarse en la
consola de Firebase antes de considerar la instalación completamente auditada.

## Historial técnico

Las notas de las fases anteriores están en `docs/historial-versiones/`.
