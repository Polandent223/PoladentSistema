const CACHE_NAME = 'poladent-v9-final';
const APP_SHELL = [
  './', './index.html', './empleado.html',
  './css/sistema-comercial.css', './css/empleado.css', './css/seguridad-asistencia.css',
  './firebase/config.js',
  './apps/data-store.js', './apps/performance-runtime.js', './apps/app.js', './apps/empleado.js',
  './apps/modules/empleados-ui.js', './apps/modules/configuracion-permisos.js',
  './apps/modules/gps-multisede.js', './apps/modules/interfaz-comercial.js',
  './apps/modules/estabilidad-seguridad.js', './apps/modules/nomina.js',
  './apps/modules/licencia.js', './apps/modules/multiempresa.js',
  './apps/modules/diagnostico-final.js', './apps/modules/panel-lateral-unico.js',
  './apps/modules/gestion-horarios.js', './apps/modules/correccion-marcaciones.js',
  './apps/modules/roles-permisos-sucursales.js', './apps/modules/administracion-avanzada.js',
  './apps/modules/optimizacion-comercial.js',
  './img/favicon.png', './img/logo-poladent.png', './img/logo-poladent.jpg', './img/logo-poladent-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then(response => {
      if (response && response.ok) caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
      return response;
    }).catch(() => caches.match(event.request).then(r => r || caches.match('./index.html'))));
    return;
  }

  event.respondWith(caches.match(event.request).then(cached => {
    const network = fetch(event.request).then(response => {
      if (response && response.ok) caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
      return response;
    }).catch(() => cached);
    return cached || network;
  }));
});
