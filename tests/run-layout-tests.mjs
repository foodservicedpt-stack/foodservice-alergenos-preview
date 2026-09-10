#!/usr/bin/env node
// =====================================================================
//  Tests automatizados de layout — foodservice-alergenos-preview
//  Comprueba, en contenedores críticos y en 3 resoluciones:
//    - scrollWidth <= clientWidth
//    - scrollHeight <= clientHeight
//    - sin clipping, sin solape, sin texto truncado, sin iconos fuera, sin scroll
//  Uso:  node tests/run-layout-tests.mjs
//  Requiere Google Chrome. Configurable con la variable CHROME.
// =====================================================================
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PAGES = [
  { name: 'comedor', file: 'comedor.html' },
  { name: 'comidas', file: 'comidas_especiales.html' }
];
const RESOLUTIONS = [[1920, 1080], [2560, 1440], [3840, 2160]];
const COUNTS = [1, 2, 4, 6, 8, 10, 12, 16, 20];
const PROFILES = ['corto', 'largo', 'traduccion', 'alergenos', 'trazas', 'extremo'];
const ALL_IDS = ['gluten','crustaceos','huevos','pescado','cacahuetes','soja','lacteos','cascara','apio','mostaza','sesamo','sulfitos','moluscos','altramuces'];
const LONG_ES = 'ENSALADA TEMPLADA DE QUINOA CON AGUACATE, TOMATE CHERRY, MAIZ DULCE Y ALINO DE MOSTAZA Y MIEL';
const LONG_EN = 'Warm quinoa salad with avocado, cherry tomato, sweetcorn and honey mustard dressing with toasted sesame seeds';

const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.json':'application/json', '.md':'text/plain' };

function makeDish(profile, i) {
  const d = { id: 'd' + i, oculto: false, sinGluten: i % 3 === 0, contiene: [], trazas: [] };
  if (profile === 'corto') { d.nombreEs = 'CROQUETAS'; d.nombreEn = 'Croquettes'; d.contiene = ALL_IDS.slice(0, 1); }
  else if (profile === 'largo') { d.nombreEs = LONG_ES; d.nombreEn = LONG_EN; d.contiene = ALL_IDS.slice(0, 2); }
  else if (profile === 'traduccion') { d.nombreEs = 'SOPA'; d.nombreEn = LONG_EN + ' ' + LONG_EN; d.contiene = ALL_IDS.slice(0, 1); }
  else if (profile === 'alergenos') { d.nombreEs = 'MERLUZA A LA PLANCHA'; d.nombreEn = 'Grilled hake'; d.contiene = ALL_IDS.slice(0, 14); }
  else if (profile === 'trazas') { d.nombreEs = 'MERLUZA A LA PLANCHA'; d.nombreEn = 'Grilled hake'; d.trazas = ALL_IDS.slice(0, 14); }
  else { d.nombreEs = LONG_ES; d.nombreEn = LONG_EN; d.contiene = ALL_IDS.slice(0, 14); d.trazas = ALL_IDS.slice(0, 14); }
  return d;
}
const makeData = (profile, n) => Array.from({ length: n }, (_, i) => makeDish(profile, i));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── servidor estático ──
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(ROOT, url === '/' ? 'index.html' : url);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('404'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = 'http://127.0.0.1:' + server.address().port;

// ── chrome ──
const debugPort = 9333;
const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-layout-tests-'));
const chrome = spawn(CHROME, ['--headless=new','--disable-gpu','--no-first-run','--hide-scrollbars',
  '--remote-debugging-port=' + debugPort, '--user-data-dir=' + profileDir, 'about:blank'], { stdio: 'ignore' });

let ws, id = 0; const pending = new Map();
async function connect() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch('http://127.0.0.1:' + debugPort + '/json/list')).json();
      const page = list.find((t) => t.type === 'page');
      if (page) {
        ws = await new Promise((res, rej) => { const w = new WebSocket(page.webSocketDebuggerUrl); w.onopen = () => res(w); w.onerror = rej; });
        ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); } };
        return;
      }
    } catch (e) { /* retry */ }
    await sleep(250);
  }
  throw new Error('No se pudo conectar a Chrome en ' + debugPort);
}
const send = (method, params = {}) => new Promise((res, rej) => { const mid = ++id; pending.set(mid, { res, rej }); ws.send(JSON.stringify({ id: mid, method, params })); });
async function evalIn(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}
async function waitReady() {
  for (let i = 0; i < 40; i++) {
    try { if (await evalIn('typeof LayoutEngine') === 'object' && await evalIn('typeof initDishPagination') === 'function') return; } catch (e) {}
    await sleep(200);
  }
  throw new Error('La página no cargó LayoutEngine/initDishPagination');
}

const testExpr = (data) => '(function(){' +
  'var data=' + JSON.stringify(data) + ';' +
  'try{ latestComedorData={fecha:todayStr(),platos:data}; }catch(e){}' +
  'try{ if(window.MOCK_DB&&window.MOCK_DB["menu/comedor"]) window.MOCK_DB["menu/comedor"].platos=data; }catch(e){}' +
  'window.initDishPagination(data);' +
  'var mc=document.getElementById("main-col");' +
  'var v=dishPagination.lastValidation||{ok:false,problems:[{type:"sin-validacion"}]};' +
  'var doc=document.documentElement; var fails=[];' +
  'if(mc.scrollWidth>mc.clientWidth) fails.push("container-scrollWidth");' +
  'if(mc.scrollHeight>mc.clientHeight) fails.push("container-scrollHeight");' +
  'if(doc.scrollWidth>doc.clientWidth) fails.push("document-scrollWidth");' +
  'if(doc.scrollHeight>doc.clientHeight) fails.push("document-scrollHeight");' +
  'v.problems.forEach(function(p){ fails.push(p.type); });' +
  'return { fails:fails, ok:v.ok, escala:+dishPagination.scale.toFixed(3), paginas:dishPagination.pages.length };' +
'})()';

async function main() {
  await connect();
  await send('Page.enable'); await send('Runtime.enable');
  let total = 0, failed = 0; const failures = [];
  for (const p of PAGES) {
    for (const [w, h] of RESOLUTIONS) {
      await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
      await send('Page.navigate', { url: BASE + '/' + p.file });
      await waitReady();
      await sleep(300);
      for (const profile of PROFILES) {
        for (const n of COUNTS) {
          total++;
          const r = await evalIn(testExpr(makeData(profile, n)));
          if (!r.ok || r.fails.length) { failed++; failures.push({ page: p.name, res: w + 'x' + h, profile, n, fails: [...new Set(r.fails)] }); }
        }
      }
      process.stdout.write('.');
    }
  }
  console.log('\n');
  console.log('CASOS:', total, '| FALLOS:', failed);
  if (failures.length) {
    console.log('\nDETALLE DE FALLOS:');
    failures.slice(0, 30).forEach((f) => console.log('  ' + f.page + ' ' + f.res + ' ' + f.profile + ' n=' + f.n + ' -> ' + f.fails.join(', ')));
    if (failures.length > 30) console.log('  ... y ' + (failures.length - 30) + ' más');
  } else {
    console.log('TODOS LOS TESTS PASAN');
  }
  return failed;
}

let code = 1;
try { code = (await main()) ? 1 : 0; }
catch (e) { console.error('ERROR EN LOS TESTS:', e.message); code = 1; }
finally {
  try { ws && ws.close(); } catch (e) {}
  try { chrome.kill('SIGKILL'); } catch (e) {}
  try { server.close(); } catch (e) {}
  try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch (e) {}
}
process.exit(code);
