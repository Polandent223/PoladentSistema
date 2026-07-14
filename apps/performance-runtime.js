/*
 * Poladent Performance Runtime
 * Optimiza actualizaciones visuales sin cambiar rutas ni datos de Firebase.
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
      try { job(); } catch (error) { console.error('[PoladentPerformance]', error); }
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
    if ('requestIdleCallback' in global) {
      return global.requestIdleCallback(job, { timeout });
    }
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

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator) || location.protocol !== 'https:') return;
    global.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(error => {
        console.warn('[Poladent] No se pudo registrar la caché local:', error);
      });
    }, { once: true });
  }

  registerServiceWorker();

  global.PoladentPerformance = Object.freeze({ schedule, debounce, idle, whenVisible });
})(window);
