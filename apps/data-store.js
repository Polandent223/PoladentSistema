/*
 * PoladentData: almacén compartido de lecturas Firebase.
 * Fase B - evita abrir múltiples escuchas permanentes para la misma ruta.
 * No cambia rutas, no escribe datos y no elimina historial.
 */
(function (global) {
  'use strict';

  const channels = new Map();
  let readyTimer = null;

  function firebaseReady() {
    return !!(global.firebase && firebase.apps && firebase.apps.length && typeof firebase.database === 'function');
  }

  function waitForFirebase() {
    if (firebaseReady() || readyTimer) return;
    readyTimer = setInterval(() => {
      if (!firebaseReady()) return;
      clearInterval(readyTimer);
      readyTimer = null;
      channels.forEach((channel, path) => startChannel(path, channel));
    }, 120);
  }

  function startChannel(path, channel) {
    if (channel.started || !firebaseReady()) return;
    channel.started = true;
    channel.ref = firebase.database().ref(path);
    channel.nativeHandler = snapshot => {
      channel.snapshot = snapshot;
      channel.hasValue = true;
      const notify = () => channel.listeners.forEach(listener => {
        try { listener(snapshot); }
        catch (error) { console.error('[PoladentData] Error en suscriptor de', path, error); }
      });
      if (global.PoladentPerformance) global.PoladentPerformance.whenVisible('data:' + path, notify);
      else queueMicrotask(notify);
    };
    channel.ref.on('value', channel.nativeHandler, error => {
      console.error('[PoladentData] No se pudo leer', path, error);
    });
  }

  function ensureChannel(path) {
    const normalized = String(path || '').replace(/^\/+|\/+$/g, '');
    if (!normalized) throw new Error('La ruta Firebase es obligatoria.');
    if (!channels.has(normalized)) {
      channels.set(normalized, {
        listeners: new Set(),
        snapshot: null,
        hasValue: false,
        started: false,
        ref: null,
        nativeHandler: null
      });
    }
    const channel = channels.get(normalized);
    if (firebaseReady()) startChannel(normalized, channel);
    else waitForFirebase();
    return { path: normalized, channel };
  }

  function subscribe(path, listener) {
    if (typeof listener !== 'function') throw new TypeError('El suscriptor debe ser una función.');
    const entry = ensureChannel(path);
    entry.channel.listeners.add(listener);
    if (entry.channel.hasValue) {
      queueMicrotask(() => {
        if (entry.channel.listeners.has(listener)) listener(entry.channel.snapshot);
      });
    }
    return function unsubscribe() {
      entry.channel.listeners.delete(listener);
    };
  }

  function getSnapshot(path) {
    const normalized = String(path || '').replace(/^\/+|\/+$/g, '');
    return channels.get(normalized)?.snapshot || null;
  }

  function getValue(path, fallback = null) {
    const snapshot = getSnapshot(path);
    return snapshot ? snapshot.val() : fallback;
  }

  function once(path) {
    const cached = getSnapshot(path);
    if (cached) return Promise.resolve(cached);
    return new Promise((resolve, reject) => {
      let unsubscribe = null;
      try {
        unsubscribe = subscribe(path, snapshot => {
          if (unsubscribe) unsubscribe();
          resolve(snapshot);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  function connected() {
    return firebaseReady() && navigator.onLine;
  }

  function diagnostics() {
    return Array.from(channels.entries()).map(([path, channel]) => ({
      path,
      subscribers: channel.listeners.size,
      connected: channel.started,
      cached: channel.hasValue
    }));
  }

  global.PoladentData = Object.freeze({ subscribe, once, getSnapshot, getValue, diagnostics, connected });
})(window);
