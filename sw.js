/* Service worker retirado para evitar servir versiones antiguas. */
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil((async()=>{
  const keys=await caches.keys();
  await Promise.all(keys.filter(k=>/^poladent-/i.test(k)).map(k=>caches.delete(k)));
  await self.registration.unregister();
  await self.clients.claim();
})()));
