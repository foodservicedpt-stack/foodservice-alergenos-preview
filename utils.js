// ══════════════════════════════════════════════
//  SHARED UTILITIES
//  Used by comedor.html, gestion.html, desayuno.html
// ══════════════════════════════════════════════
window.todayStr = function () {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

window.escHtml = function (s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

window.normalizeAllergenList = function (val) {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(x => typeof x === 'string');
  if (typeof val === 'object') {
    if (Array.isArray(val.allergenId)) return val.allergenId.filter(x => typeof x === 'string');
    return Object.values(val).filter(x => typeof x === 'string');
  }
  return [];
};

// Saneado de valores que acaban en atributos HTML (seguridad antii-nyección).
// Se usan al renderizar ids/colores/horas en handlers inline y style/src.
window.safeId = function (v) { return String(v || '').replace(/[^A-Za-z0-9_-]/g, ''); };
window.safeColor = function (v) { return /^#[0-9a-fA-F]{6}$/.test(String(v || '')) ? String(v) : '#1e3a5f'; };
window.safeHora = function (v) { return /^[0-9]{1,2}:[0-9]{2}$/.test(String(v || '')) ? String(v) : ''; };
window.safeImagePath = function (v) { return /^[A-Za-z0-9_./:?&=-]+$/.test(String(v || '')) ? String(v) : ''; };

window.normalizeDish = function (raw) {
  if (!raw || typeof raw !== 'object') return raw;
  return {
    ...raw,
    id: safeId(raw.id),
    contiene: normalizeAllergenList(raw.contiene),
    trazas: normalizeAllergenList(raw.trazas),
    sinGluten: !!raw.sinGluten,
    oculto: !!raw.oculto,
  };
};

window.minToHHMM = function (total) {
  total = ((total % 1440) + 1440) % 1440;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};
