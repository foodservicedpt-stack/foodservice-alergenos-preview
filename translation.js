// ══════════════════════════════════════════════
//  SHARED TRANSLATION MODULE
//  Used by comedor.html, gestion.html, desayuno.html
// ══════════════════════════════════════════════

window.correctTranslation = function (text) {
  if (!text) return text;
  let corrected = text;
  const lower = text.toLowerCase();
  for (const [wrong, right] of Object.entries(CORRECTOR_PLATOS)) {
    const pattern = new RegExp('\\b' + wrong.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi');
    if (pattern.test(lower)) {
      corrected = corrected.replace(pattern, right);
    }
  }
  for (const [wrong, right] of Object.entries(CORRECTOR_INGLES)) {
    const pattern = new RegExp('\\b' + wrong.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi');
    if (pattern.test(lower)) {
      corrected = corrected.replace(pattern, right);
    }
  }
  return corrected;
};

window.toTitleCaseSmart = function (str) {
  const small = new Set(['with', 'in', 'and', 'of', 'the', 'a', 'an', 'on', 'to', 'sauce', 'style', 'de', 'del', 'el', 'la', 'los', 'las', 'y']);
  const words = str.toLowerCase().split(/\s+/);
  return words.map((w, i) => {
    if (i > 0 && small.has(w)) return w;
    return w.replace(/^[\wà-ÿ]/, c => c.toUpperCase());
  }).join(' ');
};

// URL del proxy de traducción. Rellénala al desplegar la función serverless.
// La clave de Gemini vive en el servidor (nunca en el cliente).
window.TRANSLATE_PROXY_URL = '';

// Traduce ES → EN. type cambia el prompt ('dish' | 'cierre' | 'turno' | 'reminder').
window.translateCulinaryText = async function (text, type = 'dish') {
  if (!text || !String(text).trim()) return '';
  const q = String(text).trim();

  // 1) Proxy con Gemini (clave protegida en servidor).
  if (window.TRANSLATE_PROXY_URL) {
    try {
      const resp = await fetch(window.TRANSLATE_PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: q, type })
      });
      const json = await resp.json();
      if (json && json.ok && json.text) return correctTranslation(json.text);
    } catch(e) { console.warn('Proxy translation failed, using MyMemory:', e); }
  }

  // 2) Fallback sin clave: MyMemory.
  try {
    const url = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(q) + '&langpair=es|en';
    const resp = await fetch(url);
    const json = await resp.json();
    if (json && json.responseStatus === 200 && json.responseData && json.responseData.translatedText) {
      return correctTranslation(json.responseData.translatedText);
    }
  } catch(e) { console.warn('MyMemory translation failed:', e); }
  return '';
};

window.autoTranslateDish = async function (dish) {
  if (!dish || !dish.nombreEs || !dish.nombreEs.trim()) return;
  const en = await translateCulinaryText(dish.nombreEs, 'dish');
  if (en) {
    dish.nombreEn = toTitleCaseSmart(en);
    return dish.nombreEn;
  }
};
