/*
 * Poladent Sistema - Parte 7
 * Optimización comercial, estado de sincronización y protección de acciones.
 * No modifica la estructura ni los datos de Firebase.
 */
(function (global) {
  'use strict';

  const STORAGE_ERRORS = 'poladent_runtime_errors_v1';
  const MAX_ERRORS = 40;
  const state = { busy: 0, status: 'ready' };

  function $(id) { return document.getElementById(id); }

  function safeReadErrors() {
    try { return JSON.parse(localStorage.getItem(STORAGE_ERRORS) || '[]'); }
    catch (_) { return []; }
  }

  function saveError(source, error) {
    try {
      const list = safeReadErrors();
      list.unshift({
        fecha: new Date().toISOString(),
        origen: String(source || 'sistema'),
        mensaje: String(error && (error.message || error) || 'Error desconocido').slice(0, 500)
      });
      localStorage.setItem(STORAGE_ERRORS, JSON.stringify(list.slice(0, MAX_ERRORS)));
    } catch (_) {}
  }

  function ensureStatus() {
    let el = $('poladentSyncStatus');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'poladentSyncStatus';
    el.className = 'poladentSyncStatus';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
    return el;
  }

  function setStatus(type, text) {
    state.status = type;
    const el = ensureStatus();
    el.className = 'poladentSyncStatus status-' + type;
    el.textContent = text;
  }

  function updateNetworkStatus() {
    if (!navigator.onLine) {
      setStatus('offline', 'Sin conexión · datos locales disponibles');
      return;
    }
    if (state.busy > 0) setStatus('syncing', 'Sincronizando…');
    else setStatus('ready', 'Sistema sincronizado');
  }

  function beginSync() {
    state.busy += 1;
    updateNetworkStatus();
  }

  function endSync() {
    state.busy = Math.max(0, state.busy - 1);
    updateNetworkStatus();
  }

  function protectButtons() {
    document.addEventListener('click', function (event) {
      const button = event.target.closest('button');
      if (!button || button.disabled || button.dataset.allowRapidClick === 'true') return;
      if (button.dataset.clickLock === '1') {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      button.dataset.clickLock = '1';
      button.classList.add('poladent-action-running');
      setTimeout(function () {
        button.dataset.clickLock = '0';
        button.classList.remove('poladent-action-running');
      }, 700);
    }, true);
  }

  function observeFirebaseActivity() {
    let attempts = 0;
    const timer = setInterval(function () {
      attempts += 1;
      if (!global.firebase || !global.firebase.database) {
        if (attempts > 25) clearInterval(timer);
        return;
      }
      clearInterval(timer);
      try {
        const originalRef = global.firebase.database.Reference && global.firebase.database.Reference.prototype;
        if (!originalRef || originalRef.__poladentWrapped) return;
        ['set', 'update', 'remove', 'transaction'].forEach(function (method) {
          if (typeof originalRef[method] !== 'function') return;
          const original = originalRef[method];
          originalRef[method] = function () {
            beginSync();
            try {
              const result = original.apply(this, arguments);
              if (result && typeof result.finally === 'function') return result.finally(endSync);
              endSync();
              return result;
            } catch (error) {
              endSync();
              saveError('Firebase.' + method, error);
              throw error;
            }
          };
        });
        originalRef.__poladentWrapped = true;
      } catch (error) { saveError('observador Firebase', error); }
    }, 200);
  }

  function lazyLoadHeavyLibraries() {
    // Las librerías siguen disponibles; se evita bloquear la primera pintura cuando el navegador lo permite.
    const heavy = Array.from(document.querySelectorAll('script[src*="xlsx"],script[src*="jspdf"],script[src*="chart.js"],script[src*="jszip"]'));
    heavy.forEach(function (script) { script.setAttribute('fetchpriority', 'low'); });
  }

  function installErrorCapture() {
    global.addEventListener('error', function (event) {
      saveError('JavaScript', event.error || event.message);
    });
    global.addEventListener('unhandledrejection', function (event) {
      saveError('Promesa', event.reason);
    });
  }

  function exposeDiagnostics() {
    global.PoladentRuntime = Object.freeze({
      beginSync: beginSync,
      endSync: endSync,
      setStatus: setStatus,
      getErrors: safeReadErrors,
      clearErrors: function () { localStorage.removeItem(STORAGE_ERRORS); },
      version: 'Parte 7 Comercial'
    });
  }

  function init() {
    lazyLoadHeavyLibraries();
    installErrorCapture();
    protectButtons();
    observeFirebaseActivity();
    ensureStatus();
    updateNetworkStatus();
    global.addEventListener('online', updateNetworkStatus);
    global.addEventListener('offline', updateNetworkStatus);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) updateNetworkStatus();
    });
    exposeDiagnostics();
    document.documentElement.classList.add('poladent-parte7-ready');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})(window);
