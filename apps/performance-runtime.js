/* Poladent Runtime Estable
 * Evita que una versión antigua quede atrapada en la caché del navegador.
 * No modifica Firebase ni los datos del sistema.
 */
(function (global) {
  'use strict';

  const pending = new Map();
  let frameId = 0;

  function flush() {
    frameId = 0;
    const jobs = Array.from(pending.values());
    pending.clear();
    for (const job of jobs) {
      try { job(); } catch (error) { console.error('[PoladentRuntime]', error); }
    }
  }

  function schedule(key, job) {
    if (typeof job !== 'function') return;
    pending.set(String(key || 'default'), job);
    if (!frameId) frameId = requestAnimationFrame(flush);
  }

  function debounce(fn, wait = 120) {
    let timer = 0;
    return function debounced(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  function idle(job, timeout = 1200) {
    if ('requestIdleCallback' in global) return global.requestIdleCallback(job, { timeout });
    return setTimeout(job, Math.min(timeout, 250));
  }

  function whenVisible(key, job) {
    if (!document.hidden) return schedule(key, job);
    const onVisible = () => {
      if (document.hidden) return;
      document.removeEventListener('visibilitychange', onVisible);
      schedule(key, job);
    };
    document.addEventListener('visibilitychange', onVisible);
  }

  async function clearLegacyServiceWorker() {
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(reg => reg.unregister()));
      }
      if ('caches' in global) {
        const keys = await caches.keys();
        await Promise.all(keys.filter(k => /^poladent-/i.test(k)).map(k => caches.delete(k)));
      }
    } catch (error) {
      console.warn('[Poladent] No se pudo limpiar la caché anterior:', error);
    }
  }

  // La caché antigua fue una causa frecuente de pantallas en blanco y archivos desactualizados.
  global.addEventListener('load', clearLegacyServiceWorker, { once: true });

  global.PoladentPerformance = Object.freeze({ schedule, debounce, idle, whenVisible });
})(window);
