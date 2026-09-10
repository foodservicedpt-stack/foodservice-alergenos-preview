#!/usr/bin/env node
// =====================================================================
//  Tests automatizados de layout — foodservice-alergenos-preview
//  - 2 pantallas x 4 resoluciones x 9 escenarios x cantidades 1..20
//  - comprueba scrollWidth/Height y clipping/solape/overflow/fuera
//  - prueba de resize (recalcula, sin overflow, sin bucles, paginas validas)
//  Uso:  node tests/run-layout-tests.mjs      (requiere Google Chrome)
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
const RESOLUTIONS = [[1280, 720], [1920, 1080], [2560, 1440], [3840, 2160]];
const COUNTS = [1, 2, 4, 6, 8, 10, 12, 16, 20];
const ALL = ['gluten','crustaceos','huevos','pescado','cacahuetes','soja','lacteos','cascara','apio','mostaza','sesamo','sulfitos','moluscos','altramuces'];
const LONG_ES = 'ENSALADA TEMPLADA DE QUINOA CON AGUACATE, TOMATE CHERRY, MAIZ DULCE Y ALINO DE MOSTAZA Y MIEL';
const LONG_EN = 'Warm quinoa salad with avocado, cherry tomato, sweetcorn and honey mustard dressing with toasted sesame seeds';
const NORMAL = [
  { es:'CROQUETAS CASERAS DE JAMON', en:'Homemade ham croquettes', c:['gluten','lacteos','huevos'], t:['apio'] },
  { es:'MERLUZA A LA PLANCHA', en:'Grilled hake', c:['pescado'], t:['lacteos','gluten'] },
  { es:'LENTEJAS ESTOFADAS', en:'Stewed lentils', c:['sulfitos'], t:['apio'] },
  { es:'POLLO ASADO CON PATATAS', en:'Roast chicken with potatoes', c:[], t:[] },
  { es:'PAELLA DE MARISCO', en:'Seafood paella', c:['crustaceos','moluscos','pescado'], t:['sulfitos'] },
  { es:'TARTA DE QUESO', en:'Cheesecake', c:['lacteos','huevos','gluten'], t:['cascara','soja'] }
];
const MENU12 = [
  { es:'GUISO TRADICIONAL DE GARBANZOS CON ESPINACAS, ZANAHORIA, CEBOLLA CARAMELIZADA Y SALSA DE TOMATE CASERA', en:'Traditional chickpea stew with spinach, carrot, caramelised onion and homemade tomato sauce', c:['apio','sulfitos'], t:['gluten','lacteos'], g:true },
  { es:'MERLUZA AL HORNO CON PATATAS PANADERA Y PIMIENTOS ROJOS ASADOS', en:'Baked hake with baker\u2019s potatoes and roasted red peppers', c:['pescado'], t:['lacteos','gluten'], g:true },
  { es:'CROQUETAS CASERAS DE JAMON IBERICO', en:'Homemade Iberian ham croquettes', c:['gluten','lacteos','huevos'], t:['apio'], g:false },
  { es:'ENSALADA TEMPLADA DE QUINOA CON AGUACATE, TOMATE CHERRY, MAIZ DULCE Y ALINO DE MOSTAZA Y MIEL', en:'Warm quinoa salad with avocado, cherry tomato, sweetcorn and honey mustard dressing', c:ALL.slice(0,14), t:['gluten','sesamo'], g:false },
  { es:'LENTEJAS ESTOFADAS CON CHORIZO Y MORCILLA', en:'Stewed lentils with chorizo and black pudding', c:['sulfitos'], t:['apio'], g:true },
  { es:'POLLO ASADO DE CORRAL CON PATATAS Y PIMIENTOS', en:'Free-range roast chicken with potatoes and peppers', c:[], t:[], g:true },
  { es:'TARTA DE QUESO CON FRUTOS DEL BOSQUE Y SALSA DE FRAMBUESA', en:'Cheesecake with wild berries and raspberry sauce', c:['lacteos','huevos','gluten'], t:['cascara','soja'], g:false },
  { es:'PAELLA DE MARISCO CON CALAMARES Y GAMBAS', en:'Seafood paella with squid and prawns', c:['crustaceos','moluscos','pescado'], t:['sulfitos'], g:true },
  { es:'SOPA DE PICADILLO CON HUEVO DURO Y JAMON', en:'Picadillo soup with hard-boiled egg and ham', c:['gluten','huevos'], t:['apio'], g:false },
  { es:'CREMA DE CALABAZA CON SEMILLAS DE SESAMO TOSTADO', en:'Pumpkin soup with toasted sesame seeds', c:['lacteos'], t:['sesamo','apio'], g:true },
  { es:'BACALAO A LA VIZCAINA CON PATATAS Y PIMIENTOS', en:'Biscayan-style cod with potatoes and peppers', c:['pescado','sulfitos'], t:['gluten'], g:false },
  { es:'FRUTA DE TEMPORADA Y YOGUR NATURAL', en:'Seasonal fruit and natural yoghurt', c:['lacteos'], t:[], g:true }
];
const SCENARIOS = ['A','B','C','D','E','F','G','H','MENU12'];

function dish(sc, i) {
  const d = { id:'d'+i, oculto:false, sinGluten:i % 3 === 0, contiene:[], trazas:[] };
  if (sc === 'A') { const n = NORMAL[i % NORMAL.length]; d.nombreEs=n.es; d.nombreEn=n.en; d.contiene=n.c.slice(); d.trazas=n.t.slice(); }
  else if (sc === 'B') { d.nombreEs=LONG_ES; d.nombreEn='Salad'; d.contiene=ALL.slice(0,2); }
  else if (sc === 'C') { d.nombreEs=LONG_ES; d.nombreEn=LONG_EN; d.contiene=ALL.slice(0,2); }
  else if (sc === 'D') { d.nombreEs='MERLUZA A LA PLANCHA'; d.nombreEn='Grilled hake'; d.contiene=ALL.slice(0,14); }
  else if (sc === 'E') { d.nombreEs='MERLUZA A LA PLANCHA'; d.nombreEn='Grilled hake'; d.trazas=ALL.slice(0,14); }
  else if (sc === 'F') { d.nombreEs=LONG_ES; d.nombreEn=LONG_EN; d.contiene=ALL.slice(0,14); d.trazas=ALL.slice(0,14); }
  else if (sc === 'G') { const r = NORMAL[i % NORMAL.length]; const l = i % 3 === 0; d.nombreEs=l?LONG_ES:r.es; d.nombreEn=l?LONG_EN:r.en; d.contiene=l?ALL.slice(0,4):r.c.slice(); d.trazas=l?ALL.slice(4,8):r.t.slice(); }
  else { d.nombreEs=LONG_ES + ' CON SALSA DE TOMATE CASERA Y HIERBAS PROVENZALES'; d.nombreEn=LONG_EN + ', served with homemade tomato sauce and Provencal herbs'; d.contiene=ALL.slice(0,14); d.trazas=ALL.slice(0,14); }
  return d;
}
function buildData(sc, n) {
  if (sc === 'MENU12') return MENU12.map((m, i) => ({ id:'m'+i, oculto:false, sinGluten:!!m.g, nombreEs:m.es, nombreEn:m.en, contiene:m.c.slice(), trazas:m.t.slice() }));
  return Array.from({ length:n }, (_, i) => dish(sc, i));
}

const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.json':'application/json', '.md':'text/plain' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(ROOT, url === '/' ? 'index.html' : url);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('404'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = 'http://127.0.0.1:' + server.address().port;

const debugPort = 9334;
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
    } catch (e) {}
    await sleep(250);
  }
  throw new Error('No se pudo conectar a Chrome');
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
  throw new Error('La página no cargó el motor');
}
const SET_DATA = (data) => 'try{ latestComedorData={fecha:todayStr(),platos:' + JSON.stringify(data) + '}; }catch(e){}' +
  'try{ if(window.MOCK_DB&&window.MOCK_DB["menu/comedor"]) window.MOCK_DB["menu/comedor"].platos=' + JSON.stringify(data) + '; }catch(e){}';
const testExpr = (data) => '(function(){' + SET_DATA(data) +
  'window.initDishPagination(latestComedorData.platos);' +
  'var mc=document.getElementById("main-col");' +
  'var v=dishPagination.lastValidation||{ok:false,problems:[{type:"sin-validacion"}]};' +
  'var doc=document.documentElement; var fails=[];' +
  'if(mc.scrollWidth>mc.clientWidth) fails.push("container-scrollWidth");' +
  'if(mc.scrollHeight>mc.clientHeight) fails.push("container-scrollHeight");' +
  'if(doc.scrollWidth>doc.clientWidth) fails.push("document-scrollWidth");' +
  'if(doc.scrollHeight>doc.clientHeight) fails.push("document-scrollHeight");' +
  'if(v.unfit) fails.push("unfit-min-scale");' +
  'v.problems.forEach(function(p){ fails.push(p.type); });' +
  'return { fails:fails, ok:v.ok, escala:+dishPagination.scale.toFixed(3), reason:v.reason, paginas:dishPagination.pages.map(function(p){return p.length;}) };' +
'})()';
const readExpr = '(function(){' +
  'var mc=document.getElementById("main-col");' +
  'var v=dishPagination.lastValidation||{ok:false,problems:[]}; var fails=[];' +
  'if(mc.scrollWidth>mc.clientWidth) fails.push("container-scrollWidth");' +
  'if(mc.scrollHeight>mc.clientHeight) fails.push("container-scrollHeight");' +
  'if(v.unfit) fails.push("unfit");' +
  'v.problems.forEach(function(p){ fails.push(p.type); });' +
  'var pages=dishPagination.pages.map(function(p){return p.length;});' +
  'if(!pages.length||pages.some(function(x){return x<1;})) fails.push("paginas-invalidas");' +
  'return { fails:fails, ok:v.ok, escala:+dishPagination.scale.toFixed(3), paginas:pages, engines:(window.__engCount||0) };' +
'})()';

async function main() {
  await connect();
  await send('Page.enable'); await send('Runtime.enable');
  let total = 0, failed = 0; const failures = [];

  // ── 1) Matriz de layout ──
  for (const p of PAGES) {
    for (const [w, h] of RESOLUTIONS) {
      await send('Emulation.setDeviceMetricsOverride', { width:w, height:h, deviceScaleFactor:1, mobile:false });
      await send('Page.navigate', { url: BASE + '/' + p.file });
      await waitReady(); await sleep(250);
      for (const sc of SCENARIOS) {
        const counts = sc === 'MENU12' ? [12] : COUNTS;
        for (const n of counts) {
          total++;
          const r = await evalIn(testExpr(buildData(sc, n)));
          if (!r.ok || r.fails.length) { failed++; failures.push({ kind:'layout', page:p.name, res:w+'x'+h, sc, n, fails:[...new Set(r.fails)] }); }
        }
      }
      process.stdout.write('.');
    }
  }

  // ── 2) Prueba de resize ──
  const resizeRows = [];
  let resizeFailed = 0;
  for (const p of PAGES) {
    await send('Emulation.setDeviceMetricsOverride', { width:1920, height:1080, deviceScaleFactor:1, mobile:false });
    await send('Page.navigate', { url: BASE + '/' + p.file });
    await waitReady(); await sleep(250);
    const sc = 'G';
    await evalIn(SET_DATA(buildData(sc, 12)));
    await evalIn('window.initDishPagination(latestComedorData.platos); window.__engCount=0;' +
      'if(!window.__engWrapped){window.__engWrapped=true; var O=LayoutEngine.Engine; LayoutEngine.Engine=function(o){window.__engCount++; return new O(o);};}');
    let maxEngines = 0;
    for (const [w, h] of [[1280,720],[3840,2160],[2560,1440],[1920,1080],[1280,720]]) {
      await evalIn('window.__engCount=0');
      await send('Emulation.setDeviceMetricsOverride', { width:w, height:h, deviceScaleFactor:1, mobile:false });
      await sleep(500);
      const r = await evalIn(readExpr);
      maxEngines = Math.max(maxEngines, r.engines);
      if (r.fails.length || !r.ok) { resizeFailed++; failures.push({ kind:'resize', page:p.name, res:w+'x'+h, sc, n:12, fails:[...new Set(r.fails)] }); }
      resizeRows.push({ page:p.name, res:w+'x'+h, escala:r.escala, paginas:r.paginas.join('+'), engines:r.engines, ok:r.ok && !r.fails.length });
    }
    // detección de bucle: demasiadas reconstrucciones del motor por un resize
    if (maxEngines > 20) { resizeFailed++; failures.push({ kind:'resize-loop', page:p.name, res:'-', sc, n:12, fails:['engines='+maxEngines] }); }
  }

  console.log('\n');
  console.log('MATRIZ DE LAYOUT: casos =', total, '| fallos =', failed);
  console.log('PRUEBA DE RESIZE:  fallos =', resizeFailed);
  if (failures.length) {
    console.log('\nDETALLE:');
    failures.slice(0, 30).forEach((f) => console.log('  [' + f.kind + '] ' + f.page + ' ' + f.res + ' ' + f.sc + ' n=' + f.n + ' -> ' + f.fails.join(', ')));
    if (failures.length > 30) console.log('  ... y ' + (failures.length - 30) + ' más');
  } else {
    console.log('TODOS LOS TESTS PASAN');
  }
  console.log('\nRESIZE (detalle):');
  resizeRows.forEach((r) => console.log('  ' + r.page.padEnd(8) + ' ' + r.res.padEnd(10) + ' escala=' + r.escala + ' paginas=' + r.paginas + ' motores=' + r.engines + ' ' + (r.ok ? 'OK' : 'FALLO')));
  return failed + resizeFailed;
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
