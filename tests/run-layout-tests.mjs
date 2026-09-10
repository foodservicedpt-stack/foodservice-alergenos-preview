#!/usr/bin/env node
// =====================================================================
//  Auditoría automatizada de layout — foodservice-alergenos-preview
//  Usa el fixture compartido fixtures.js (mismo que debug-layout.html).
//  Secciones: matriz, MENU12 canónico, resize determinista, cambios de
//  contenido, caso imposible, comedor cerrado, overflow decorativo, desayuno.
//  Uso: node tests/run-layout-tests.mjs   (requiere Google Chrome)
//  Salida: tabla TEST | RESULTADO | EVIDENCIA y código 0/1.
// =====================================================================
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import FIXTURES from '../fixtures.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PAGES = [
  { name: 'comedor', file: 'comedor.html' },
  { name: 'comidas', file: 'comidas_especiales.html' }
];
const RES = [[1280,720],[1920,1080],[2560,1440],[3840,2160]];
const COUNTS = [1,2,4,6,8,10,12,16,20];
const MATRIX_SCENARIOS = ['A','B','C','D','E','F','G','H','MENU12'];

const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.json':'application/json','.md':'text/plain' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
function record(test, result, evidence) { results.push({ test, result, evidence }); }

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(ROOT, url === '/' ? 'index.html' : url);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('404'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = 'http://127.0.0.1:' + server.address().port;

const debugPort = 9335;
const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-layout-audit-'));
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
async function goto(file, w, h) {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: BASE + '/' + file + '?nc=' + Date.now() + Math.random() });
  for (let i = 0; i < 40; i++) {
    try { if (await evalIn('typeof LayoutEngine') === 'object' && await evalIn('typeof initDishPagination') === 'function') break; } catch (e) {}
    await sleep(200);
  }
  await sleep(250);
}

const AUDIT_DEF = [
"window.__audit = function(expectedN){",
"  var mc=document.getElementById('main-col');",
"  var dp=dishPagination;",
"  var v=dp.lastValidation||{ok:false,problems:[{type:'sin-validacion'}]};",
"  var problems={}; v.problems.forEach(function(p){problems[p.type]=(problems[p.type]||0)+1;});",
"  var pages=dp.pages.map(function(p){return p.length;});",
"  var total=pages.reduce(function(a,b){return a+b;},0);",
"  var vacias=pages.filter(function(x){return x===0;}).length;",
"  var rows=Array.prototype.slice.call(mc.querySelectorAll('.dish-row'));",
"  var icoOutside=0, viewportOutside=0, realClip=0;",
"  var vw=window.innerWidth, vh=window.innerHeight;",
"  function outside(el,box){var r=el.getBoundingClientRect(),b=box.getBoundingClientRect();return (r.left<b.left-1)||(r.right>b.right+1)||(r.top<b.top-1)||(r.bottom>b.bottom+1);}",
"  rows.forEach(function(row){",
"    var rb=row.getBoundingClientRect();",
"    if(rb.left<-1||rb.right>vw+1||rb.top<-1||rb.bottom>vh+1) viewportOutside++;",
"    Array.prototype.slice.call(row.querySelectorAll('*')).forEach(function(el){",
"      var r=el.getBoundingClientRect(); if(r.width===0&&r.height===0) return;",
"      if(r.left<-1||r.right>vw+1||r.top<-1||r.bottom>vh+1) viewportOutside++;",
"      if(el.classList&&el.classList.contains('alg-icon-wrap')&&outside(el,row)) icoOutside++;",
"      var cs=getComputedStyle(el);",
"      if((cs.overflowX!=='visible'&&el.scrollWidth>el.clientWidth+1)||(cs.overflowY!=='visible'&&el.scrollHeight>el.clientHeight+1)) realClip++;",
"    });",
"  });",
"  var rowHeights=rows.map(function(r){return Math.round(r.getBoundingClientRect().height);});",
"  var badRowHeight=rowHeights.filter(function(h){return h<=0||h>mc.clientHeight;}).length;",
"  var fails=[];",
"  if(v.unfit) fails.push('unfit');",
"  if(!v.ok) fails.push('validacion-no-ok');",
"  if(mc.scrollWidth>mc.clientWidth) fails.push('container-overflow-x');",
"  if(mc.scrollHeight>mc.clientHeight) fails.push('container-overflow-y');",
"  if(document.documentElement.scrollWidth>document.documentElement.clientWidth) fails.push('document-overflow-x');",
"  if(document.documentElement.scrollHeight>document.documentElement.clientHeight) fails.push('document-overflow-y');",
"  if(total!==expectedN) fails.push('perdida-de-platos');",
"  if(vacias>0) fails.push('paginas-vacias');",
"  if(rows.length!==(pages[0]||0)) fails.push('filas-renderizadas');",
"  if(icoOutside>0) fails.push('iconos-fuera');",
"  if(viewportOutside>0) fails.push('fuera-del-viewport');",
"  if(badRowHeight>0) fails.push('altura-de-fila-invalida');",
"  if(realClip>0) fails.push('clipping-real');",
"  if(problems['row-overlap']||problems['blocks-overlap']) fails.push('solape');",
"  if(problems['child-outside-row']) fails.push('elemento-fuera');",
"  return { escala:+dp.scale.toFixed(4), sMax:v.sMax!=null?+v.sMax.toFixed(4):null, floorScale:v.floorScale!=null?+v.floorScale.toFixed(4):null,",
"    reason:v.reason||null, unfit:!!v.unfit, ok:!!v.ok, paginas:pages, reparto:pages.join('+'), total:total, entradas:expectedN, vacias:vacias,",
"    overflowH:mc.scrollWidth>mc.clientWidth, overflowV:mc.scrollHeight>mc.clientHeight,",
"    clip:realClip, solape:(problems['row-overlap']||0)+(problems['blocks-overlap']||0), fuera:problems['child-outside-row']||0,",
"    viewportOutside:viewportOutside, icoOutside:icoOutside, badRowHeight:badRowHeight, filas:rows.length,",
"    problems:problems, fails:fails, layoutUnfit:mc.getAttribute('data-layout-unfit') };",
"};"
].join("\n");
const SET_DATA = (data) => 'try{ latestComedorData={fecha:todayStr(),platos:' + JSON.stringify(data) + '}; }catch(e){}' +
  'try{ if(window.MOCK_DB&&window.MOCK_DB["menu/comedor"]) window.MOCK_DB["menu/comedor"].platos=' + JSON.stringify(data) + '; }catch(e){}';
const injectAudit = (data, n) => '(function(){' + SET_DATA(data) + 'window.initDishPagination(latestComedorData.platos); return window.__audit(' + n + ');})()';
const TUPLE = (r) => JSON.stringify({ e:r.escala, sm:r.sMax, fl:r.floorScale, re:r.reason, pg:r.reparto, ovH:r.overflowH, ovV:r.overflowV, cl:r.clip, so:r.solape, fu:r.fuera, vp:r.viewportOutside });

async function main() {
  await connect();
  await send('Page.enable'); await send('Runtime.enable');

  // ── 1. Matriz de layout ──
  let mTotal = 0, mFail = 0; const mFailures = [];
  for (const p of PAGES) {
    for (const [w,h] of RES) {
      await goto(p.file, w, h);
      await evalIn(AUDIT_DEF);
      for (const sc of MATRIX_SCENARIOS) {
        const counts = sc === 'MENU12' ? [12] : COUNTS;
        for (const n of counts) {
          mTotal++;
          const r = await evalIn(injectAudit(FIXTURES.buildData(sc, n), n));
          if (r.fails.length) { mFail++; mFailures.push(p.name + ' ' + w + 'x' + h + ' ' + sc + ' n=' + n + ' -> ' + [...new Set(r.fails)].join(',')); }
        }
      }
    }
  }
  record('Matriz de layout (A-H + MENU12, 4 resoluciones, 1-20)',
    mFail ? 'FAIL' : 'PASS',
    mTotal + ' casos, ' + mFail + ' fallos' + (mFail ? ': ' + mFailures.slice(0,3).join(' | ') : ', 0 overflow/clip/solape/fuera'));

  // ── 2. MENU12_CANONICAL por resolución (carga limpia) ──
  const menuFresh = {};
  for (const [w,h] of RES) {
    await goto('comedor.html', w, h);
    await evalIn(AUDIT_DEF);
    menuFresh[w+'x'+h] = await evalIn(injectAudit(FIXTURES.buildData('MENU12'), 12));
  }
  record('MENU12_CANONICAL en carga limpia (4 resoluciones)',
    Object.values(menuFresh).every((r) => !r.fails.length) ? 'PASS' : 'FAIL',
    RES.map(([w,h]) => w+'x'+h+': e='+menuFresh[w+'x'+h].escala+' pag='+menuFresh[w+'x'+h].reparto+' '+menuFresh[w+'x'+h].reason).join(' · '));

  // ── 3. Resize determinista (fresh vs tras resize) ──
  await goto('comedor.html', 1920, 1080);
  await evalIn(AUDIT_DEF);
  await evalIn(injectAudit(FIXTURES.buildData('MENU12'), 12));
  const afterResize = {};
  for (const [w,h] of [[2560,1440],[1280,720],[3840,2160],[1920,1080]]) {
    await send('Emulation.setDeviceMetricsOverride', { width:w, height:h, deviceScaleFactor:1, mobile:false });
    await sleep(600);
    afterResize[w+'x'+h] = await evalIn('window.__audit(12)');
  }
  const resCompare = [];
  let resizeOk = true;
  for (const key of ['1920x1080','2560x1440','1280x720','3840x2160']) {
    const same = TUPLE(menuFresh[key]) === TUPLE(afterResize[key]);
    if (!same) resizeOk = false;
    resCompare.push(key + (same ? '=igual' : '=DISTINTO'));
  }
  record('Resize determinista (carga limpia vs 1920→2560→1280→3840→1920)',
    resizeOk ? 'PASS' : 'FAIL',
    resCompare.join(' · '));

  // ── 4. Cambios de contenido sin recargar ──
  await goto('comedor.html', 1920, 1080);
  await evalIn(AUDIT_DEF);
  const seq = [ ['n',1],['n',4],['n',8],['n',12],['n',20],['sc','MENU12'],['sc','H'],['n',1] ];
  const seqOut = []; let seqOk = true; let first1 = null, last1 = null;
  for (const [kind, val] of seq) {
    const data = kind === 'n' ? FIXTURES.buildData('G', val) : FIXTURES.buildData(val, 12);
    const n = kind === 'n' ? val : 12;
    const r = await evalIn(injectAudit(data, n));
    if (r.fails.length) seqOk = false;
    seqOut.push((kind === 'n' ? ('n=' + val) : val) + '→e' + r.escala + ',p' + r.reparto);
    if (kind === 'n' && val === 1 && first1 === null) first1 = TUPLE(r);
    if (kind === 'n' && val === 1 && first1 !== null) last1 = TUPLE(r);
  }
  const reproducible = first1 === last1;
  record('Cambios de contenido sin recargar y vuelta a 1 plato',
    (seqOk && reproducible) ? 'PASS' : 'FAIL',
    seqOut.join(' · ') + ' | reproducible=' + reproducible);

  // ── 5. Caso imposible ──
  await goto('comedor.html', 1920, 1080);
  await evalIn(AUDIT_DEF);
  await evalIn('window.__engCount=0; if(!window.__engWrapped){window.__engWrapped=true; var O=LayoutEngine.Engine; LayoutEngine.Engine=function(o){window.__engCount++; return new O(o);};}');
  const t0 = Date.now();
  const imp = await evalIn(injectAudit(FIXTURES.buildData('IMPOSSIBLE', 1), 1));
  const impMs = Date.now() - t0;
  const engines = await evalIn('window.__engCount');
  const impReport = await evalIn('JSON.stringify(window.__lastLayoutReport)').then(JSON.parse).catch(() => null);
  const impOk = imp.unfit === true && imp.reason === 'unfit-min-scale' && imp.ok === false &&
    imp.layoutUnfit === 'true' && engines === 1 && impMs < 5000 &&
    (imp.problems['container-overflow-y'] || imp.problems['row-overflow-y']);
  record('Caso imposible (no cabe ni a MIN_SCALE)',
    impOk ? 'PASS' : 'FAIL',
    'unfit=' + imp.unfit + ', reason=' + imp.reason + ', ok=' + imp.ok + ', data-layout-unfit=' + imp.layoutUnfit +
    ', problems=' + JSON.stringify(imp.problems) + ', motores=' + engines + ', ' + impMs + 'ms, report.unfit=' + (impReport && impReport.unfit));

  // ── 6. Comedor cerrado ──
  await goto('comedor.html', 1920, 1080);
  await evalIn("cierreConfig={activo:true}; refreshCierre(); window.__ticks=0; var _o=window.updateCierreClock; window.updateCierreClock=function(){window.__ticks++; return _o.apply(this,arguments);};");
  await sleep(2600);
  const closed = await evalIn([
    "(function(){",
    "var ov=document.getElementById('cierre-overlay');",
    "var textos=Array.prototype.slice.call(ov.querySelectorAll('*')).filter(function(e){return !e.children.length&&e.textContent.trim();}).map(function(e){return e.textContent.trim();});",
    "var all=ov.textContent;",
    "var prohibidos=['El comedor está cerrado','The dining room is closed','HORA ACTUAL','CURRENT TIME'].filter(function(s){return all.indexOf(s)!==-1;});",
    "var turno=document.getElementById('turno-overlay');",
    "return { textos:textos, prohibidos:prohibidos, ticks:window.__ticks, visible:ov.classList.contains('visible'),",
    " turnoOpacity:getComputedStyle(turno).opacity, scrollW:ov.scrollWidth, clientW:ov.clientWidth, scrollH:ov.scrollHeight, clientH:ov.clientHeight };",
    "})()"
  ].join("\n"));
  const clockOk = closed.textos.some((t) => /^\d{1,2}:\d{2}$/.test(t));
  const requiredOk = ['Food Service DPT','COMEDOR CERRADO','DINING ROOM CLOSED'].every((t) => closed.textos.indexOf(t) !== -1);
  const noExtra = closed.textos.filter((t) => !/^\d{1,2}:\d{2}$/.test(t)).length === 3;
  const closedOk = closed.visible && requiredOk && noExtra && closed.prohibidos.length === 0 && closed.ticks >= 2 && clockOk;
  record('Estado "Comedor cerrado" (textos, sin carousel, reloj vivo)',
    closedOk ? 'PASS' : 'FAIL',
    'textos=' + JSON.stringify(closed.textos) + ', prohibidos=' + JSON.stringify(closed.prohibidos) + ', ticks=' + closed.ticks + ', turnoOpacity=' + closed.turnoOpacity);

  // ── 7. Overflow decorativo del cierre ──
  const decorOk = closed.scrollW === closed.clientW && closed.scrollH === closed.clientH;
  record('Overflow decorativo del cierre (scroll === client)',
    decorOk ? 'PASS' : 'FAIL',
    'scrollW=' + closed.scrollW + ' clientW=' + closed.clientW + ', scrollH=' + closed.scrollH + ' clientH=' + closed.clientH);

  // ── 8. Desayuno: alcance ──
  await goto('desayuno.html', 1920, 1080);
  const des = await evalIn([
    "(function(){",
    "var usesEngine = (typeof LayoutEngine!=='undefined');",
    "var c=document.getElementById('print-dishes');",
    "var pl=document.querySelector('.print-layout');",
    "return { usesEngine:usesEngine,",
    "  dishes: c?{sw:c.scrollWidth,cw:c.clientWidth,sh:c.scrollHeight,ch:c.clientHeight}:null,",
    "  layout: pl?{sw:pl.scrollWidth,cw:pl.clientWidth,sh:pl.scrollHeight,ch:pl.clientHeight}:null };",
    "})()"
  ].join("\n"));
  const desOverflow = (des.dishes && (des.dishes.sw > des.dishes.cw || des.dishes.sh > des.dishes.ch)) ||
                      (des.layout && (des.layout.sw > des.layout.cw || des.layout.sh > des.layout.ch));
  record('Cobertura del desayuno',
    des.usesEngine ? 'FAIL' : (desOverflow ? 'WARN' : 'PASS'),
    des.usesEngine
      ? 'desayuno usa LayoutEngine (debería revisarse)'
      : 'NO usa layout-engine (layout de impresión propio). print-dishes=' + JSON.stringify(des.dishes) + ', print-layout=' + JSON.stringify(des.layout));

  return results;
}

let rows = [];
try { rows = await main(); }
catch (e) { record('EJECUCIÓN', 'FAIL', 'Excepción: ' + e.message); rows = results; }
finally {
  try { ws && ws.close(); } catch (e) {}
  try { chrome.kill('SIGKILL'); } catch (e) {}
  try { server.close(); } catch (e) {}
  try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch (e) {}
}

console.log('\n================ RESULTADOS ================');
const w1 = Math.max(...rows.map((r) => r.test.length), 5);
console.log('TEST'.padEnd(w1) + ' | RESULTADO | EVIDENCIA');
console.log('-'.repeat(w1 + 40));
rows.forEach((r) => console.log(r.test.padEnd(w1) + ' | ' + r.result.padEnd(9) + ' | ' + r.evidence));
const c = { PASS: 0, WARN: 0, FAIL: 0 };
rows.forEach((r) => { c[r.result] = (c[r.result] || 0) + 1; });
console.log('-'.repeat(w1 + 40));
console.log('TOTAL: PASS=' + c.PASS + ' WARN=' + c.WARN + ' FAIL=' + c.FAIL);
process.exit(c.FAIL ? 1 : 0);
