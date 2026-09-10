// =====================================================================
//  LAYOUT ENGINE — motor determinista de layout del comedor
//  ---------------------------------------------------------------------
//  Principios:
//   1. MEDICIÓN REAL: las filas se renderizan a tamaño natural (sin
//      flex-shrink) en una sonda del mismo ancho que el contenedor y se
//      miden con getBoundingClientRect().
//   2. ESCALA ADAPTATIVA: se busca por BÚSQUEDA BINARIA la mayor escala
//      válida entre MIN_SCALE y MAX_SCALE. Una escala es válida si
//      ninguna fila desborda su página ni el ancho disponible.
//   3. PAGINACIÓN: reparto en el mínimo número de páginas posible a esa
//      escala y equilibrado por altura ("split array largest sum").
//   4. VALIDACIÓN: comprobación explícita de overflow, recorte, solape y
//      elementos fuera de contenedor.
//  No usa line-clamp ni oculta contenido: si no cabe, baja la escala
//  hasta MIN_SCALE y, si aun así no cabe, crea otra página.
// =====================================================================
(function (global) {
  'use strict';

  var DEFAULTS = {
    MIN_SCALE: 0.50,        // suelo duro: nunca por debajo
    LEGIBILITY_FLOOR: 0.85, // suelo blando: no se baja de aquí solo por ahorrar páginas
    MAX_SCALE: 1.40,
    SAFETY_MARGIN: 0.985,
    SCALE_PRECISION: 0.005,
    GAP: null,            // null = leer el gap real del contenedor
    reservedBottom: 0,    // altura reservada (p. ej. indicador de páginas)
    maxPages: null        // tope opcional de páginas (por defecto, sin tope)
  };

  function assign(target, src) {
    for (var k in src) {
      if (Object.prototype.hasOwnProperty.call(src, k)) target[k] = src[k];
    }
    return target;
  }

  function maxOf(arr) {
    var m = 0;
    for (var i = 0; i < arr.length; i++) if (arr[i] > m) m = arr[i];
    return m;
  }

  // ---------------------------------------------------------------- Engine
  function Engine(options) {
    this.opts = assign(assign({}, DEFAULTS), options || {});
    this.container = this.opts.container;
    this.renderRow = this.opts.renderRow;
    if (!this.container || typeof this.renderRow !== 'function') {
      throw new Error('LayoutEngine: se requieren container y renderRow');
    }
    this.lastScale = 1;
    this.lastPages = [];
    this.lastHeights = [];
    this.lastUsable = 0;
    this.lastMetrics = null;
  }

  Engine.prototype._metrics = function (reservedBottom) {
    var c = this.container;
    var cs = global.getComputedStyle(c);
    var padTop = parseFloat(cs.paddingTop) || 0;
    var padBottom = parseFloat(cs.paddingBottom) || 0;
    var padLeft = parseFloat(cs.paddingLeft) || 0;
    var padRight = parseFloat(cs.paddingRight) || 0;
    var gap = this.opts.GAP != null ? this.opts.GAP : (parseFloat(cs.rowGap || cs.gap) || 0);
    var borderX = (parseFloat(cs.borderLeftWidth) || 0) + (parseFloat(cs.borderRightWidth) || 0);
    var borderY = (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.borderBottomWidth) || 0);
    // Ancho y alto FRACCIONARIOS: clientWidth/clientHeight redondean a entero y
    // una décima de píxel puede cambiar el salto de línea de un nombre largo.
    var rect = c.getBoundingClientRect();
    return {
      padTop: padTop,
      padBottom: padBottom,
      gap: gap,
      width: Math.max(1, rect.width - borderX - padLeft - padRight),
      usable: Math.max(0, rect.height - borderY - padTop - padBottom - (reservedBottom || 0) - gap),
      containerWidth: rect.width
    };
  };

  // Renderiza las filas en una sonda oculta con el mismo ancho y escala.
  Engine.prototype._probe = function (items, scale, width) {
    var probe = global.document.createElement('div');
    probe.className = 'layout-probe';
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText =
      'position:absolute;left:-100000px;top:0;visibility:hidden;pointer-events:none;' +
      'box-sizing:border-box;width:' + width + 'px;';
    probe.style.setProperty('--page-scale', String(scale));
    var cs = global.getComputedStyle(this.container);
    probe.style.fontFamily = cs.fontFamily;
    probe.style.fontSize = cs.fontSize;
    var frag = global.document.createDocumentFragment();
    for (var i = 0; i < items.length; i++) frag.appendChild(this.renderRow(items[i]));
    probe.appendChild(frag);
    global.document.body.appendChild(probe);
    return probe;
  };

  Engine.prototype._measure = function (items, scale, width) {
    var probe = this._probe(items, scale, width);
    var rows = probe.querySelectorAll('.dish-row');
    var heights = [];
    var overflowX = false;
    for (var i = 0; i < rows.length; i++) {
      heights.push(rows[i].getBoundingClientRect().height);
      if (rows[i].scrollWidth > rows[i].clientWidth + 1) overflowX = true;
    }
    global.document.body.removeChild(probe);
    return { heights: heights, overflowX: overflowX };
  };

  Engine.prototype._isValid = function (measured, usable) {
    if (usable <= 0) return false;
    if (measured.overflowX) return false;
    return maxOf(measured.heights) <= usable * this.opts.SAFETY_MARGIN;
  };

  // -------------------------------------------------------------- layout()
  Engine.prototype.layout = function (items, options) {
    options = options || {};
    var reservedBottom = options.reservedBottom != null
      ? options.reservedBottom
      : this.opts.reservedBottom;
    var m = this._metrics(reservedBottom);
    this.lastMetrics = m;

    if (!items || !items.length) {
      this.lastScale = 1; this.lastPages = []; this.lastHeights = []; this.lastUsable = m.usable;
      return { scale: 1, pages: [], heights: [], usable: m.usable, metrics: m };
    }

    var lo = this.opts.MIN_SCALE;
    var hi = this.opts.MAX_SCALE;
    var best = null;
    var self = this;

    var top = this._measure(items, hi, m.width);
    if (this._isValid(top, m.usable)) {
      best = { scale: hi, heights: top.heights };
    } else {
      var guard = 0;
      while (guard < 60 && (hi - lo) > this.opts.SCALE_PRECISION) {
        var mid = (lo + hi) / 2;
        var measured = self._measure(items, mid, m.width);
        if (self._isValid(measured, m.usable)) {
          best = { scale: mid, heights: measured.heights };
          lo = mid;
        } else {
          hi = mid;
        }
        guard++;
      }
    }

    // Mayor escala válida (legibilidad máxima).
    var sMax = best ? best.scale : this.opts.MIN_SCALE;
    var scale = sMax;
    var self2 = this;

    // Suelo del paso de minimización de páginas: nunca por debajo de
    // LEGIBILITY_FLOOR, pero tampoco por encima de la mayor escala válida.
    var floorScale = Math.min(sMax, Math.max(this.opts.MIN_SCALE, this.opts.LEGIBILITY_FLOOR));

    // Política: minimizar el número de páginas, pero sin bajar del suelo de
    // legibilidad; entre las escalas que logran ese mínimo, la mayor posible.
    if (!this.opts.maxPages) {
      if (floorScale < sMax) {
        var pTop = self2._pageCount(items, sMax, m, null);
        var pFloor = self2._pageCount(items, floorScale, m, null);
        if (pFloor < pTop) {
          // floorScale ya se midió y logra pFloor páginas: es un punto de
          // partida VÁLIDO. Sin inicializar aquí, si el umbral que logra el
          // mínimo es más estrecho que SCALE_PRECISION la búsqueda no muestrea
          // ninguna escala válida y la escala se quedaba en sMax (sin ahorro).
          var loS = floorScale, hiS = sMax;
          scale = floorScale;
          while ((hiS - loS) > this.opts.SCALE_PRECISION) {
            var midS = (loS + hiS) / 2;
            if (self2._pageCount(items, midS, m, null) <= pFloor) { scale = midS; loS = midS; }
            else hiS = midS;
          }
        }
      }
    }

    var heights = (best && Math.abs(scale - sMax) < 1e-9)
      ? best.heights
      : this._measure(items, scale, m.width).heights;
    var pages = this._paginate(items, heights, m, this.opts.maxPages);

    // Motivo explícito de la escala elegida (observabilidad; no altera el cálculo):
    //   unfit-min-scale   → nada cabe ni siquiera a MIN_SCALE (se usa MIN_SCALE como último recurso)
    //   content-limited   → el propio contenido obliga a bajar de LEGIBILITY_FLOOR
    //   max-scale         → cabe a MAX_SCALE y no se gana nada reduciendo
    //   pages-minimized   → se redujo (sin bajar del suelo) para ahorrar páginas
    var reason;
    if (!best) reason = 'unfit-min-scale';
    else if (Math.abs(scale - sMax) < 1e-9) {
      reason = (sMax < this.opts.LEGIBILITY_FLOOR - 1e-9) ? 'content-limited' : 'max-scale';
    } else reason = 'pages-minimized';

    this.lastScale = scale;
    this.lastHeights = heights;
    this.lastPages = pages;
    this.lastUsable = m.usable;
    this.lastReason = reason;
    this.lastSMax = sMax;
    this.lastFloorScale = floorScale;
    this.lastUnfit = !best;
    return {
      scale: scale, pages: pages, heights: heights, usable: m.usable, metrics: m,
      sMax: sMax, floorScale: floorScale, reason: reason, unfit: !best
    };
  };

  // Número de páginas (reparto secuencial con capacidad dada).
  Engine.prototype._pageCount = function (items, scale, m, maxPages) {
    var measured = this._measure(items, scale, m.width);
    var gap = m.gap;
    var cap = m.usable * this.opts.SAFETY_MARGIN + gap;
    var groups = 1, cur = 0;
    for (var i = 0; i < measured.heights.length; i++) {
      var c = Math.max(0, measured.heights[i]) + gap;
      if (c > cap) return Infinity;
      if (cur + c > cap) { groups++; cur = c; }
      else cur += c;
    }
    if (maxPages && groups > maxPages) return Infinity;
    return groups;
  };

  // ------------------------------------------------------------ paginación
  // Mínimo número de páginas con capacidad dada y reparto equilibrado por
  // altura (búsqueda binaria sobre la "suma máxima por página").
  Engine.prototype._paginate = function (items, heights, m, maxPages) {
    var gap = m.gap;
    var cap = m.usable * this.opts.SAFETY_MARGIN + gap;
    var costs = new Array(heights.length);
    for (var i = 0; i < heights.length; i++) costs[i] = Math.max(0, heights[i]) + gap;

    function countWith(maxSum) {
      var groups = 1, cur = 0;
      for (var j = 0; j < costs.length; j++) {
        var c = costs[j];
        if (c > maxSum) return Infinity;
        if (cur + c > maxSum) { groups++; cur = c; }
        else cur += c;
      }
      return groups;
    }

    var P = countWith(cap);
    if (!isFinite(P)) P = costs.length;
    if (maxPages && P > maxPages) P = maxPages;

    var lo = 0, hiSum = 0;
    for (var k = 0; k < costs.length; k++) { hiSum += costs[k]; if (costs[k] > lo) lo = costs[k]; }
    while (lo < hiSum) {
      var midSum = Math.floor((lo + hiSum) / 2);
      if (countWith(midSum) <= P) hiSum = midSum; else lo = midSum + 1;
    }
    var maxSum = lo;

    var groups = [], curGroup = [], curSum = 0;
    for (var n = 0; n < costs.length; n++) {
      var cost = costs[n];
      if (curGroup.length && curSum + cost > maxSum) {
        groups.push(curGroup); curGroup = []; curSum = 0;
      }
      curGroup.push(items[n]); curSum += cost;
    }
    if (curGroup.length) groups.push(curGroup);
    return groups;
  };

  // ------------------------------------------------------------ validación
  Engine.prototype.validate = function () {
    var c = this.container;
    var problems = [];
    var push = function (type, detail) { problems.push(assign({ type: type }, detail || {})); };

    if (c.scrollWidth > c.clientWidth) push('container-overflow-x', { scrollWidth: c.scrollWidth, clientWidth: c.clientWidth });
    if (c.scrollHeight > c.clientHeight) push('container-overflow-y', { scrollHeight: c.scrollHeight, clientHeight: c.clientHeight });

    var rows = c.querySelectorAll('.dish-row');
    var rects = [];
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var rect = row.getBoundingClientRect();
      rects.push(rect);

      if (row.scrollWidth > row.clientWidth + 1) push('row-overflow-x', { row: i });
      if (row.scrollHeight > row.clientHeight + 1) push('row-overflow-y', { row: i });

      var kids = row.querySelectorAll('*');
      for (var j = 0; j < kids.length; j++) {
        var el = kids[j];
        var er = el.getBoundingClientRect();
        if (er.width === 0 && er.height === 0) continue;
        var ecs = global.getComputedStyle(el);
        var clipsX = ecs.overflowX !== 'visible' && el.scrollWidth > el.clientWidth + 1;
        var clipsY = ecs.overflowY !== 'visible' && el.scrollHeight > el.clientHeight + 1;
        if (clipsX || clipsY) {
          push('text-clipped', {
            row: i, el: String(el.className || el.tagName),
            scrollWidth: el.scrollWidth, clientWidth: el.clientWidth,
            scrollHeight: el.scrollHeight, clientHeight: el.clientHeight
          });
        }
        if (er.left < rect.left - 1 || er.right > rect.right + 1 ||
            er.top < rect.top - 1 || er.bottom > rect.bottom + 1) {
          push('child-outside-row', { row: i, el: String(el.className || el.tagName) });
        }
      }

      var content = row.querySelector('.dish-content');
      var allergens = row.querySelector('.dish-allergens');
      if (content && allergens) {
        var cr = content.getBoundingClientRect();
        var ar = allergens.getBoundingClientRect();
        if (cr.right > ar.left + 1 && cr.left < ar.right - 1 &&
            cr.bottom > ar.top + 1 && cr.top < ar.bottom - 1) {
          push('blocks-overlap', { row: i });
        }
      }
    }

    for (var a = 0; a < rects.length; a++) {
      for (var b = a + 1; b < rects.length; b++) {
        if (rects[a].bottom > rects[b].top + 1 && rects[b].bottom > rects[a].top + 1) {
          push('row-overlap', { rows: [a, b] });
        }
      }
    }

    return {
      ok: problems.length === 0,
      problems: problems,
      scale: this.lastScale,
      sMax: this.lastSMax,
      floorScale: this.lastFloorScale,
      reason: this.lastReason,
      unfit: this.lastUnfit,
      pages: this.lastPages.length,
      rows: rows.length
    };
  };

  global.LayoutEngine = {
    Engine: Engine,
    DEFAULTS: DEFAULTS,
    MIN_SCALE: DEFAULTS.MIN_SCALE,
    MAX_SCALE: DEFAULTS.MAX_SCALE,
    SAFETY_MARGIN: DEFAULTS.SAFETY_MARGIN
  };
})(window);
