// =====================================================================
//  FIXTURES COMPARTIDOS — fuente única de datos de prueba
//  Se usa en: debug-layout.html (navegador) y tests/run-layout-tests.mjs (Node).
//  Así el "menú extremo" es EXACTAMENTE el mismo en todas partes.
// =====================================================================
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FIXTURES = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var ALL = ['gluten','crustaceos','huevos','pescado','cacahuetes','soja','lacteos','cascara','apio','mostaza','sesamo','sulfitos','moluscos','altramuces'];

  var LONG_ES = 'ENSALADA TEMPLADA DE QUINOA CON AGUACATE, TOMATE CHERRY, MAIZ DULCE Y ALINO DE MOSTAZA Y MIEL';
  var LONG_EN = 'Warm quinoa salad with avocado, cherry tomato, sweetcorn and honey mustard dressing with toasted sesame seeds';

  var NORMAL = [
    { es:'CROQUETAS CASERAS DE JAMON', en:'Homemade ham croquettes', c:['gluten','lacteos','huevos'], t:['apio'] },
    { es:'MERLUZA A LA PLANCHA', en:'Grilled hake', c:['pescado'], t:['lacteos','gluten'] },
    { es:'LENTEJAS ESTOFADAS', en:'Stewed lentils', c:['sulfitos'], t:['apio'] },
    { es:'POLLO ASADO CON PATATAS', en:'Roast chicken with potatoes', c:[], t:[] },
    { es:'PAELLA DE MARISCO', en:'Seafood paella', c:['crustaceos','moluscos','pescado'], t:['sulfitos'] },
    { es:'TARTA DE QUESO', en:'Cheesecake', c:['lacteos','huevos','gluten'], t:['cascara','soja'] }
  ];

  // ── FIXTURE CANÓNICO DEL MENÚ DE 12 PLATOS ──
  // Requisitos: nombres largos ES, traducciones largas, hasta 14 alérgenos,
  // hasta 14 trazas, combinaciones variadas, platos cortos y largos, y al
  // menos uno extremadamente largo. El nº 5 es el nombre pedido en el encargo.
  var MENU12_CANONICAL = [
    { es:'FRUTA DE TEMPORADA', en:'Seasonal fruit', c:[], t:[] },
    { es:'YOGUR NATURAL', en:'Natural yoghurt', c:['lacteos'], t:[] },
    { es:'CROQUETAS CASERAS DE JAMON', en:'Homemade ham croquettes', c:['gluten','lacteos','huevos'], t:['apio'] },
    { es:'MERLUZA AL HORNO CON PATATAS PANADERA Y PIMIENTOS ROJOS ASADOS', en:'Baked hake with baker\u2019s potatoes and roasted red peppers', c:['pescado'], t:['lacteos','gluten'] },
    { es:'GUISO TRADICIONAL DE GARBANZOS CON ESPINACAS, ZANAHORIA, CEBOLLA CARAMELIZADA Y SALSA DE TOMATE CASERA', en:'Traditional chickpea stew with spinach, carrot, caramelised onion and homemade tomato sauce', c:['apio','sulfitos'], t:['gluten','lacteos'] },
    { es:'ENSALADA TEMPLADA DE QUINOA CON AGUACATE, TOMATE CHERRY, MAIZ DULCE Y ALINO DE MOSTAZA Y MIEL', en:'Warm quinoa salad with avocado, cherry tomato, sweetcorn and honey mustard dressing with toasted sesame seeds', c:ALL.slice(0,14), t:['gluten','sesamo'] },
    { es:'PAELLA DE MARISCO CON CALAMARES, GAMBAS Y MEJILLONES', en:'Seafood paella with squid, prawns and mussels', c:['crustaceos','moluscos','pescado'], t:['sulfitos'] },
    { es:'LENTEJAS ESTOFADAS CON CHORIZO Y MORCILLA', en:'Stewed lentils with chorizo and black pudding', c:['sulfitos'], t:['apio'] },
    { es:'TARTA DE QUESO CON FRUTOS DEL BOSQUE Y SALSA DE FRAMBUESA', en:'Cheesecake with wild berries and raspberry sauce', c:['lacteos','huevos','gluten'], t:['cascara','soja'] },
    { es:'SOPA DE PICADILLO CON HUEVO DURO Y JAMON', en:'Picadillo soup with hard-boiled egg and ham', c:['gluten','huevos'], t:['apio'] },
    { es:'CREMA DE CALABAZA ASADA CON SEMILLAS DE SESAMO TOSTADO, ACEITE DE OLIVA VIRGEN EXTRA, CROUTONS DE PAN INTEGRAL Y HIERBAS PROVENZALES FRESCAS', en:'Roasted pumpkin soup with toasted sesame seeds, extra virgin olive oil, wholemeal croutons and fresh Provencal herbs', c:ALL.slice(0,14), t:ALL.slice(0,14) },
    { es:'BACALAO A LA VIZCAINA CON PATATAS Y PIMIENTOS VERDES', en:'Biscayan-style cod with potatoes and green peppers', c:['pescado','sulfitos'], t:['gluten'] }
  ];

  // ── Caso imposible: un nombre que no cabe ni a MIN_SCALE=0.50 ──
  var IMPOSSIBLE_DISH = {
    id: 'impossible-0',
    nombreEs: new Array(120).join('GUISO EXTENSO ') + 'FINAL',
    nombreEn: new Array(120).join('Extremely long dish name ') + 'END',
    contiene: ALL.slice(0, 14),
    trazas: ALL.slice(0, 14),
    sinGluten: false,
    oculto: false
  };

  function cloneDish(d) {
    return { id: d.id || 'x', oculto: false, sinGluten: !!d.sinGluten, nombreEs: d.nombreEs, nombreEn: d.nombreEn, contiene: (d.contiene||[]).slice(), trazas: (d.trazas||[]).slice() };
  }
  function fromRow(r, id, sinGluten) {
    return { id: id, oculto: false, sinGluten: !!sinGluten, nombreEs: r.es, nombreEn: r.en, contiene: (r.c||[]).slice(), trazas: (r.t||[]).slice() };
  }

  var SCENARIOS = ['A','B','C','D','E','F','G','H','MENU12','IMPOSSIBLE'];

  function buildData(scenario, n) {
    n = n || 12;
    var out = [], i, d, r;
    if (scenario === 'MENU12') return MENU12_CANONICAL.map(function (m, k) { return fromRow(m, 'm' + k, k % 3 === 0); });
    if (scenario === 'IMPOSSIBLE') {
      for (i = 0; i < n; i++) { d = cloneDish(IMPOSSIBLE_DISH); d.id = 'imp' + i; out.push(d); }
      return out;
    }
    for (i = 0; i < n; i++) {
      if (scenario === 'A') { r = NORMAL[i % NORMAL.length]; out.push(fromRow(r, 'a' + i, i % 3 === 0)); }
      else if (scenario === 'B') out.push({ id:'b'+i, oculto:false, sinGluten:i%3===0, nombreEs:LONG_ES, nombreEn:'Salad', contiene:ALL.slice(0,2), trazas:[] });
      else if (scenario === 'C') out.push({ id:'c'+i, oculto:false, sinGluten:i%3===0, nombreEs:LONG_ES, nombreEn:LONG_EN, contiene:ALL.slice(0,2), trazas:[] });
      else if (scenario === 'D') out.push({ id:'d'+i, oculto:false, sinGluten:i%3===0, nombreEs:'MERLUZA A LA PLANCHA', nombreEn:'Grilled hake', contiene:ALL.slice(0,14), trazas:[] });
      else if (scenario === 'E') out.push({ id:'e'+i, oculto:false, sinGluten:i%3===0, nombreEs:'MERLUZA A LA PLANCHA', nombreEn:'Grilled hake', contiene:[], trazas:ALL.slice(0,14) });
      else if (scenario === 'F') out.push({ id:'f'+i, oculto:false, sinGluten:i%3===0, nombreEs:LONG_ES, nombreEn:LONG_EN, contiene:ALL.slice(0,14), trazas:ALL.slice(0,14) });
      else if (scenario === 'G') { r = NORMAL[i % NORMAL.length]; var l = (i % 3 === 0); out.push({ id:'g'+i, oculto:false, sinGluten:l, nombreEs:l?LONG_ES:r.es, nombreEn:l?LONG_EN:r.en, contiene:l?ALL.slice(0,4):(r.c||[]).slice(), trazas:l?ALL.slice(4,8):(r.t||[]).slice() }); }
      else out.push({ id:'h'+i, oculto:false, sinGluten:i%3===0, nombreEs:LONG_ES + ' CON SALSA DE TOMATE CASERA Y HIERBAS PROVENZALES', nombreEn:LONG_EN + ', served with homemade tomato sauce and Provencal herbs', contiene:ALL.slice(0,14), trazas:ALL.slice(0,14) });
    }
    return out;
  }

  return {
    ALL: ALL,
    LONG_ES: LONG_ES,
    LONG_EN: LONG_EN,
    NORMAL: NORMAL,
    MENU12_CANONICAL: MENU12_CANONICAL,
    IMPOSSIBLE_DISH: IMPOSSIBLE_DISH,
    SCENARIOS: SCENARIOS,
    buildData: buildData
  };
});
