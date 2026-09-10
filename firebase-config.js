// =====================================================================
//  PREVIEW — firebase-config.js SUSTITUIDO
//  Esta version NO contiene credenciales de produccion y NO carga el SDK
//  de Firebase. Implementa una base de datos en memoria sobre MOCK_DB
//  (mock-data.js) que respeta la API usada por las pantallas:
//    firebase.initializeApp(config)
//    firebase.database().ref(path).on('value', cb) / .off() / .once()
//                                 .set(v) / .update(v) / .push()
//  Cualquier escritura se queda en memoria (window.MOCK_DB).
// =====================================================================

window.PREVIEW_MODE = true;

// Credenciales ficticias: jamas apuntan a un proyecto real.
window.firebaseConfig = {
  apiKey:            'PREVIEW_MOCK_KEY',
  authDomain:        'foodservice-alergenos-preview.local',
  databaseURL:       '',
  projectId:         'foodservice-alergenos-preview',
  storageBucket:     '',
  messagingSenderId: '0',
  appId:             'preview-mock',
  appCheckSiteKey:   ''
};

(function installPreviewMock() {
  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function clone(v) {
    return v === undefined ? undefined : JSON.parse(JSON.stringify(v));
  }

  // Lee una ruta de MOCK_DB. Los menus llevan siempre la fecha de HOY para
  // que la preview no caiga en el estado "menu no publicado".
  function readPath(path) {
    var db = window.MOCK_DB || {};
    var value = clone(db[path]);
    if ((path === 'menu/comedor' || path === 'menu/desayuno') && value && typeof value === 'object') {
      value.fecha = todayStr();
    }
    return value;
  }

  function write(path, value) {
    if (!window.MOCK_DB) window.MOCK_DB = {};
    window.MOCK_DB[path] = clone(value);
  }

  function makeRef(path) {
    return {
      on: function (_event, cb) {
        if (typeof cb === 'function') {
          setTimeout(function () {
            try { cb({ val: function () { return readPath(path); } }); }
            catch (e) { console.error('[PREVIEW mock]', e); }
          }, 0);
        }
        return cb;
      },
      off: function () { return undefined; },
      once: function () {
        return Promise.resolve({ val: function () { return readPath(path); } });
      },
      set: function (value) { write(path, value); return Promise.resolve(); },
      update: function (value) {
        var current = readPath(path) || {};
        write(path, Object.assign({}, current, clone(value)));
        return Promise.resolve();
      },
      push: function () {
        var key = 'mock-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
        return makeRef(path + '/' + key);
      }
    };
  }

  var mockDatabase = function () { return { ref: makeRef }; };
  var real = (typeof window.firebase !== 'undefined') ? window.firebase : {};

  window.firebase = Object.assign({}, real, {
    initializeApp: function () { return { name: '[PREVIEW]' }; },
    database: mockDatabase,
    apps: [{ name: '[PREVIEW]', options: window.firebaseConfig }]
  });

  // Utilidades para pruebas / debug-layout.html
  window.__preview = { readPath: readPath, makeRef: makeRef, database: mockDatabase };
  console.log('[PREVIEW] Modo mock activo: sin SDK de Firebase y sin datos de produccion.');
})();
