// =====================================================================
//  MOCK DATA — version PREVIEW (foodservice-alergenos-preview)
//  Datos locales para probar el layout SIN tocar la base de datos de
//  produccion. Se cargan en memoria; los cambios NO salen del navegador.
//  Fuente de verdad alternativa: consulta README.md.
// =====================================================================

window.MOCK_DB = {

  // ── Menu del comedor ──
  // La fecha se reescribe a "hoy" en cada lectura (firebase-config.js),
  // para que la preview no muestre nunca "menu no publicado".
  'menu/comedor': {
    fecha: '2000-01-01', // se sustituye por la fecha real en cada lectura
    platos: [
      {
        id: 'p1', 
        nombreEs: 'ENSALADA DE GARBANZOS CON ESPINACAS Y TOMATE',
        nombreEn: 'Chickpea salad with spinach and tomato',
        contiene: ['apio', 'sulfitos'],
        trazas: ['gluten', 'lacteos'],
        sinGluten: false, oculto: false
      },
      {
        id: 'p2',
        nombreEs: 'MERLUZA A LA PLANCHA CON PATATAS PANADERA',
        nombreEn: 'Grilled hake with bakers potatoes',
        contiene: ['pescado'],
        trazas: ['lacteos', 'gluten'],
        sinGluten: true, oculto: false
      },
      {
        id: 'p3',
        nombreEs: 'CROQUETAS CASERAS DE JAMON',
        nombreEn: 'Homemade ham croquettes',
        contiene: ['gluten', 'lacteos', 'huevos'],
        trazas: ['apio'],
        sinGluten: false, oculto: false
      },
      {
        id: 'p4',
        nombreEs: 'LENTEJAS ESTOFADAS CON CHORIZO',
        nombreEn: 'Stewed lentils with chorizo',
        contiene: ['sulfitos'],
        trazas: ['apio'],
        sinGluten: true, oculto: false
      },
      {
        id: 'p5',
        nombreEs: 'POLLO ASADO CON PATATAS Y PIMIENTOS',
        nombreEn: 'Roast chicken with potatoes and peppers',
        contiene: [],
        trazas: [],
        sinGluten: true, oculto: false
      },
      {
        id: 'p6',
        nombreEs: 'TARTA DE QUESO CON FRUTOS DEL BOSQUE',
        nombreEn: 'Cheesecake with wild berries',
        contiene: ['lacteos', 'huevos', 'gluten'],
        trazas: ['cascara', 'soja'],
        sinGluten: false, oculto: false
      },
      {
        id: 'p7',
        nombreEs: 'PAELLA DE MARISCO',
        nombreEn: 'Seafood paella',
        contiene: ['crustaceos', 'moluscos', 'pescado'],
        trazas: ['sulfitos'],
        sinGluten: true, oculto: false
      },
      {
        id: 'p8',
        nombreEs: 'ENSALADA TEMPLADA DE QUINOA CON AGUACATE, TOMATE CHERRY, MAIZ Y ALINO DE MOSTAZA Y MIEL',
        nombreEn: 'Warm quinoa salad with avocado, cherry tomato, sweetcorn and honey mustard dressing',
        contiene: ['gluten','crustaceos','huevos','pescado','cacahuetes','soja','lacteos','cascara','apio','mostaza','sesamo','sulfitos','moluscos','altramuces'],
        trazas: ['gluten','crustaceos','huevos','pescado','cacahuetes','soja','lacteos','cascara','apio','mostaza','sesamo','sulfitos','moluscos','altramuces'],
        sinGluten: false, oculto: false
      }
    ]
  },

  // ── Ficha de desayuno ──
  'menu/desayuno': {
    fecha: '2000-01-01',
    platos: [
      { id: 'd1', nombre: 'CROISSANT DE MANTEQUILLA', contiene: ['gluten','lacteos','huevos'], trazas: ['cascara'], oculto: false },
      { id: 'd2', nombre: 'ZUMO DE NARANJA NATURAL', contiene: [], trazas: [], oculto: false },
      { id: 'd3', nombre: 'CAFE CON LECHE', contiene: ['lacteos'], trazas: [], oculto: false },
      { id: 'd4', nombre: 'TOSTADA CON TOMATE Y ACEITE', contiene: ['gluten'], trazas: ['sesamo'], oculto: false }
    ]
  },

  // ── Turnos (desactivados: no saltan solos en la preview) ──
  'turnos': [
    {
      id: 't1', activo: false, hora: '14:00', minutosAntes: 5,
      label: 'Cambio de Turno',
      mensajeEs: 'Gracias! Por favor, libera tu mesa.',
      mensajeEn: 'Thank you! Please clear your table.',
      bgColor: '#1e3a5f', textColor: '#ffffff'
    }
  ],

  // ── Recordatorios del carousel de turno ──
  'recordatorios': {
    carouselInterval: 15,
    reminders: [
      { mensajeEs: 'Devuelve la bandeja al office', mensajeEn: 'Please return your tray', image: '' },
      { mensajeEs: 'Recuerda separar los residuos', mensajeEn: 'Remember to separate waste', image: '' }
    ]
  },

  // ── Cierre del comedor: false = se ve el menu. Ponlo a true para Fase 4. ──
  'cierreComedor': { activo: false, programado: false, hora: '', duracion: 0, mensajeEs: '', mensajeEn: '' },

  // ── Ajustes de TV (escala de texto) ──
  'tvSettings': { textScale: 1 }
};
