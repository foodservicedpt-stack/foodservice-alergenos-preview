# ARCHITECTURE_AUDIT.md

**Proyecto:** Food Service DPT — Sistema de Alérgenos
**Subsistema auditado:** pantalla de comedor (`comedor.html`) y su motor de layout/paginación
**Fecha:** 2026-09-10
**Revisión auditada:** árbol de trabajo local de `foodservice-alergenos` (rama `main`, HEAD `23bd66c`, 2026-08-26) — **sin commitear** en el momento de la auditoría
**Modo:** solo lectura. El repositorio original no se ha modificado (ver §10).

---

## Veredicto

**BLOCK** para el motor de layout actual. La causa no es un ajuste de CSS fino: el motor de
paginación que existe en el código **nunca se ejecuta**, porque el contenedor nunca reporta
desbordamiento. Como consecuencia, los platos se comprimen, el texto se recorta con
`line-clamp` y los iconos de alérgenos se salen de su fila y se solapan. Es exactamente el
fallo que el nuevo motor debe eliminar.

- **Arquitectura de aplicación (datos, módulos compartidos):** SHIP. Está bien separada y es reutilizable.
- **Motor de layout de `comedor.html`:** BLOCK. Sustitución, no parcheo.
- **Estado "Comedor cerrado":** FIX. Funciona, pero muestra texto que hay que eliminar (§3.8).

---

## 0. Alcance y método (evidencia)

Auditoría estática del código + **medición real en navegador** con Chrome DevTools Protocol sobre:

1. la **producción desplegada** (`https://foodservicedpt-stack.github.io/foodservice-alergenos/comedor.html`),
   que corresponde a HEAD `23bd66c`;
2. el **árbol de trabajo local** servido en `http://127.0.0.1:8777`, con todo el tráfico a Firebase
   **bloqueado** en el navegador para no tocar datos de producción.

En ambos casos se inyectaron platos de prueba en el DOM de la página (nunca en la base de datos)
y se midió con `scrollHeight/clientHeight/scrollWidth/clientWidth` y `getBoundingClientRect()`.

**Comandos/medidas reproducibles en el Anexo (§11).**

---

## 1. Mapa de arquitectura

Aplicación web **estática, sin build, sin `package.json`, sin tests**. Todo es HTML + JS de
navegador sobre Firebase Realtime Database.

```text
Navegador
 ├── index.html ................ lanzador con enlaces a las 4 vistas
 │
 ├── comedor.html ★ ............ pantalla TV del menú del día (objeto de esta auditoría)
 ├── comidas_especiales.html ... 2ª pantalla TV, MISMO motor de paginación copiado/pegado
 ├── desayuno.html ............. ficha A4 imprimible (otro layout, otro motor)
 └── gestion.html .............. panel que ESCRIBE en Firebase
         │
         ├── firebase-config.js ... credenciales de PRODUCCIÓN (proyecto foodservice-alergenos-5fe9b)
         ├── allergen-data.js ..... ALLERGENS[14] + CORRECTOR_PLATOS/INGLES  (fuente única)
         ├── utils.js ............. escHtml, normalizeDish, todayStr, minToHHMM, safe*
         └── translation.js ....... translateCulinaryText (Gemini vía proxy → MyMemory)
         │
         ▼
 Firebase RTDB (prod): menu/comedor · turnos · recordatorios · cierreComedor · tvSettings
         ▲
 netlify/functions/translate.js (proxy Gemini; NO se usa para el layout)

Despliegue: .github/workflows/deploy.yml → GitHub Pages, en push a main (path: .)
```

**Dirección de dependencias:** correcta y en un solo sentido. Las vistas dependen de los tres
módulos compartidos; los módulos compartidos no conocen a las vistas. Sin ciclos.

**Duplicación estructural relevante:** `comedor.html` y `comidas_especiales.html` implementan el
mismo algoritmo de paginación por separado (`comedor.html:936-1259` vs
`comidas_especiales.html:200-281`). Es un caso real de regla de tres: el motor nuevo debería ser
un único módulo compartido y ambas pantallas consumirlo.

---

## 2. Cómo funciona `comedor.html` hoy (flujo end-to-end)

1. **Carga (head):** `firebase-config.js` → `allergen-data.js` → `utils.js` → `translation.js`
   (`comedor.html:7-12`). CSS inline en `:root` con `--text-scale: 1` (`comedor.html:16-50`).
2. **DOM inicial:** `.screen` = header (18vh) + `.body` (main-col + sidebar) + footer
   (`comedor.html:493-529`), más dos overlays a pantalla completa: `#cierre-overlay` (532-545) y
   `#turno-overlay` (548-573).
3. **Arranque:** `DOMContentLoaded` → `applyTVSettingsFromStorage()`, `buildLegend([])`,
   `initFirebase()`, `updateClock()` (`comedor.html:1407-1412`). Además `updateClock()` se
   autoinvoca y se repite con `setInterval(...,1000)` en `comedor.html:683-684`.
4. **Firebase (`initFirebase`, 1316-1373):** cinco listeners `on('value')`:
   `menu/comedor` → `refreshMenuDisplay()`; `turnos`; `recordatorios`; `cierreComedor` →
   `refreshCierre()`; `tvSettings` → `applyTVSettings()` (137-1443).
5. **Menú del día:** `refreshMenuDisplay()` (615-625) solo pinta si `data.fecha === todayStr()`;
   reinicio diario automático. Precio: si el menú es de ayer, entra en `showNoData()`.
6. **Render:** `renderMenu(data)` (1269-1285) filtra `oculto`, construye la leyenda y llama a
   `initDishPagination(platos)`.
7. **Decisión de paginación (`initDishPagination`, 1212-1259):**
   - inserta todas las filas en `#main-col`;
   - `const hasOverflow = mainCol.scrollHeight > mainCol.clientHeight` (**1221**);
   - **si NO hay overflow** → una sola página, sin puntos, `fitDishText()` y fin;
   - **si hay overflow** → `calculatePages()` → `renderDishPage()` + rotación cada 20 s.
8. **Reloj:** `updateClock()` (663-684) pinta `#header-time`, reinicia `firedTurnos` al cambiar de
   día, refresca cierre y dispara turnos al segundo `00`.
9. **Turno:** `checkTurnos()` (705-717) → `showTurno()` (719-761) → overlay con cuenta atrás y
   carousel de despedida + recordatorios (`buildTurnoCarousel`, 815-890).
10. **Sin datos:** `showNoData()` (1378-1391) y `showOfflineState()` (1392-1402).

---

## 3. Lógica por área

### 3.1 Tamaño de los platos

- La fila `.dish-row` **no tiene altura propia**: es un flex item que se reparte el alto
  disponible con `flex: 1 1 0; min-height: 0; overflow: hidden` (`comedor.html:84-93`).
- El tamaño del nombre sale de `--dish-name-size` → `--text-base`
  (`clamp(30px, calc(4.5vmin * var(--text-scale)), 8vmin)`, `comedor.html:27,38`).
- `fitDishText()` (1134-1152, **solo en el árbol de trabajo, no en producción**) reduce el
  `font-size` en pasos de 1 px al 50 % y se detiene ahí. Nunca crea una página nueva.
- Medido: con 8 platos a 1920×1080 la fuente cae a **23.6 px** (suelo del 50 %) y **aun así el
  texto sigue recortado**.

### 3.2 Paginación

- `calculatePages()` (962-1024): `minRowsPerPage = 4` (976); para ≤4 platos devuelve 1 página;
  para el resto calcula `maxRows = floor(usableH / (rowH + gap))` (999) y trocea el array en
  bloques consecutivos (1001-1003). **No equilibra** páginas ni busca escala.
- `measureAverageDishHeight()` (936-960): clona las filas en un `div` oculto de ancho
  `mainCol.clientWidth` y promedia `scrollHeight`. El problema: las filas reales son `flex:1`,
  así que la altura medida (contenido natural) **no es** la altura final renderizada.
- Rotación: `startRotation()` (1098-1106) cada 20 s, pausa al pasar el ratón (1123-1129),
  puntos `goToDishPage()` (1073-1079).
- **Hallazgo crítico:** nada de esto se ejecuta. Ver §5.

### 3.3 Escalado

- Única variable de escala: `--text-scale` (18), ajustable 0.5–2.0 desde `tvSettings` de Firebase
  (`applyTVSettings`, 1433-1443). **Solo afecta a tipografía e iconos.**
- La geometría (header 18vh, sidebar `clamp(250px,20vw,500px)`, gaps en vw, carousel 26vh) usa
  **otras unidades** y **no** participa de `--text-scale`. No hay una escala única de página.
- No existen `MIN_SCALE`, `MAX_SCALE` ni `SAFETY_MARGIN` en el código (grep: 0 coincidencias).

### 3.4 Alérgenos

- Fuente única: `window.ALLERGENS` y `ALLERGEN_BY_ID` (`allergen-data.js:5-23`) — reutilizable tal cual.
- Render en `createDishRow()` (1155-1209): sección "CONTIENE" (`.section-label.contain-label`) +
  `.allergen-grid` con `.alg-icon-wrap` de tamaño fijo `--icon-base`
  (`clamp(48px, calc(6vmin * var(--text-scale)), 10vmin)`, 32; wrap 129-138).
- El grid hace `flex-wrap: wrap` (126-128). Al envolver crece en alto **dentro de una fila de
  altura fija con `overflow:hidden`** → los iconos se salen y pisan filas vecinas. Medido:
  con 14 alérgenos, el ancho del bloque de alérgenos es ~730 px y su alto supera el de la fila.

### 3.5 Trazas

- Mismo circuito que "contiene" pero con `.trace-label` ("⚠ TRAZAS") y `.trace-icon` con opacidad
  0.8 (1186-1188, 139). **No hay umbral de espacio dedicado a trazas**; compite por el mismo alto.
- En la captura de estrés las etiquetas se cortan ("RAZAS"), prueba de que el cálculo no las tiene en cuenta.

### 3.6 Traducciones

- `translation.js`: `translateCulinaryText()` (39-66) usa proxy Gemini si `TRANSLATE_PROXY_URL`
  está definido (hoy **vacío**, 36) y si no, MyMemory. `autoTranslateDish()` (68-75) +
  `toTitleCaseSmart()` (25-32). Correcciones en `CORRECTOR_PLATOS/INGLES` (`allergen-data.js:25-151`).
- **Riesgo de layout:** no hay límite de longitud; una traducción larga se inyecta en
  `.dish-name-en` con `line-clamp: 2` (111) → recorte silencioso.
- El motor de layout **no debe** tocar la traducción: solo medirla.

### 3.7 Carousel

- Vive dentro del overlay de turno (`#turno-carousel`, 560-563). Track flex (`.carousel-track`,
  315-320), slide = `flex: 0 0 100%` (321-332), avance por `transform: translateX` (909-919).
- Altura **fija** `height: 26vh` (312) y recorte con `-webkit-line-clamp: 3` en
  `.carousel-slide.farewell .slide-text-es/.en` (389-404).
- `fitTurnoOverlay()` (766-777) solo **encoge** el carousel si la tarjeta desborda; no repagina el texto.
- **El carousel es exclusivo del turno.** El usuario ha pedido explícitamente que el estado
  "Comedor cerrado" NO lo use (no lo usa hoy), y que el layout de platos tampoco dependa de él.

### 3.8 Comedor cerrado

- Overlay `#cierre-overlay` (461-487, DOM 532-545). Se activa por `cierreConfig.activo` o por
  `cierreProgramadoActivo()` (627-635). `refreshCierre()` (636-651) rellena mensajes configurables
  desde gestión (`cierreConfig.mensajeEs/mensajeEn`).
- **Estado actual medido en producción** (captura 2026-09-10 20:03): muestra
  "FOOD SERVICE DPT", "COMEDOR CERRADO", "DINING ROOM CLOSED",
  **"El comedor está cerrado"**, **"The dining room is closed"**,
  **"HORA ACTUAL · CURRENT TIME"** y la hora. Los tres últimos son exactamente los que la Fase 4
  debe eliminar. La hora ya se actualiza cada segundo vía `updateCierreClock()` (652-658).
- `.cierre-title` usa `white-space: nowrap` (481) → riesgo de desbordamiento horizontal en
  resoluciones pequeñas.

### 3.9 Reloj

- Cabecera: `updateClock()` (663-684) → `#header-time` en formato HH:MM.
- Cierre: `updateCierreClock()` (652-658) → `#cierre-clock` en HH:MM.
- Ambos se actualizan desde el mismo `setInterval` de 1 s (683). Reutilizable tal cual para la Fase 4.

---

## 4. Inventario: dónde se calcula HOY el tamaño de los elementos

| # | Qué se calcula | Dónde | Unidad / mecanismo |
|---|---|---|---|
| 1 | Escala tipográfica global | `comedor.html:18, 1433-1443` | `--text-scale` (0.5–2.0), solo texto/iconos |
| 2 | Tamaño de nombre ES | `comedor.html:27, 38, 99` | `clamp(30px, 4.5vmin·scale, 8vmin)` |
| 3 | Tamaño de nombre EN | `comedor.html:26, 39, 109` | `clamp(22px, 3.5vmin·scale, 5.5vmin)` |
| 4 | Tamaño de icono de alérgeno | `comedor.html:32, 130` | `clamp(48px, 6vmin·scale, 10vmin)` |
| 5 | Etiquetas CONTIENE/TRAZAS | `comedor.html:120, 144, 152-153` | `clamp(...vmin·scale...)` |
| 6 | Altura del header | `comedor.html:35, 64` | `18vh` fijo |
| 7 | Ancho de la sidebar | `comedor.html:173` | `clamp(250px, 20vw, 500px)` |
| 8 | Altura del carousel de turno | `comedor.html:312, 775` | `26vh` y luego JS `max(100, h-overflow)` |
| 9 | Altura de fila de plato | `comedor.html:89` | `flex: 1 1 0` — la decide el flexbox, **no se mide** |
| 10 | Nº de filas por página | `comedor.html:999` | `floor(usableH/(rowH+gap))`, con `rowH` estimado |
| 11 | Ancho de la sonda de medición | `comedor.html:941` | `mainCol.clientWidth` con `visibility:hidden` |
| 12 | Auto-ajuste de fuente | `comedor.html:1134-1152` | bucle JS restando 1 px hasta 50 % |
| 13 | Puntos de paginación | `comedor.html:196` | `clamp(12px, 1.5vmin, 16px)` |
| 14 | Leyenda (icono/texto) | `comedor.html:182, 185-186` | `clamp(...vmin·scale...)` + `ellipsis` |

**Observación clave:** hay **dos sistemas de unidades independientes** (vw/vh para geometría y
vmin×scale para tipografía) y **la altura de la fila no se calcula en ningún sitio**: la impone
flexbox. Cualquier motor determinista debe unificar esto.

---

## 5. Causas del overflow y del clipping (diagnóstico con medidas)

### Causa raíz #1 — El contenedor nunca desborda, luego la paginación es código muerto

```css
.main-col { flex: 1; display:flex; flex-direction:column; overflow:hidden; }   /* :81  */
.dish-row { flex: 1 1 0; min-height: 0; overflow: hidden; }                    /* :84-93 */
```

Con `flex: 1 1 0` + `min-height: 0`, las filas **se encogen** para caber. El contenedor
`#main-col` nunca produce `scrollHeight > clientHeight`, así que la guarda de
`initDishPagination` (**1221**) es **siempre falsa** y se toma la rama "cabe en una página".
Resultado: `calculatePages()`, `renderDishPage()`, los puntos y la rotación **no se ejecutan jamás**.

Medición (producción y árbol de trabajo, todas las resoluciones):

| Resolución | n platos | `pages` | `colOverflowV` | filas con hijos fuera | fuente ES |
|---|---|---|---|---|---|
| 1920×1080 | 12 | `[]` | `false` | 12 / 12 | 48.6 px |
| 1920×1080 (árbol de trabajo) | 8 | `[]` | `false` | 8 / 8 | 23.6 px (suelo) |
| 1920×1080 (árbol de trabajo) | 20 | `[]` | `false` | 20 / 20 | 23.6 px (suelo) |
| 1280×720 | 8 | `[]` | `false` | 8 / 8 | 32.4 px |
| 2560×1440 | 8 | `[]` | `false` | 8 / 8 | 64.8 px |
| 3840×2160 | 8 | `[]` | `false` | 8 / 8 | 97.2 px |

### Causa raíz #2 — Recorte de texto por `line-clamp` (violación directa de la regla absoluta)

- `.dish-name-es`: `-webkit-line-clamp: 2` (`comedor.html:102`).
- `.dish-name-en`: `-webkit-line-clamp: 2` (`comedor.html:111`).
- Carousel de despedida: `line-clamp: 3` (395, 403).
- Leyenda lateral: `white-space:nowrap; overflow:hidden; text-overflow:ellipsis` (185-186).

Medición producción, 12 platos a 1920×1080: `nameScrollH = 736 px` frente a
`nameClientH = 105 px` → **~85 % del nombre queda oculto**.

### Causa raíz #3 — Los iconos de alérgenos no participan del cálculo

`.allergen-grid` envuelve (126-128) dentro de una fila de altura fija con `overflow:hidden`
(91). Con 14 alérgenos el bloque mide ~730 px de ancho y crece en alto por encima de la fila:
los iconos se dibujan fuera de su tarjeta y **se solapan con las filas contiguas** (visible en la
captura de estrés). El sistema actual **no mide** el bloque de alérgenos para decidir el alto de fila.

### Causa raíz #4 — `fitDishText()` reduce sin límite definido y sin repaginar

Reduce la fuente hasta el 50 % del tamaño computado (1145-1150) y se detiene. No hay
`MIN_SCALE` independiente de la escala de página, no hay `SAFETY_MARGIN` y, sobre todo,
**al llegar al suelo no crea otra página** — que es justo lo que exige la regla absoluta.

### Causa raíz #5 — Medición no representativa

`measureAverageDishHeight()` (936-960) mide el alto natural del contenido, pero la fila real es
`flex:1`; además promedia platos heterogéneos. Aun si la guarda #1 se corrigiera, `rowH` sería
incorrecto y el reparto de páginas también.

---

## 6. Qué reutilizar y qué sustituir

### Reutilizar tal cual (bajo riesgo)

| Elemento | Ubicación | Motivo |
|---|---|---|
| Catálogo de los 14 alérgenos | `allergen-data.js:5-23` | Fuente única de verdad; ya indexado por id |
| Utilidades | `utils.js` (`escHtml`, `normalizeDish`, `todayStr`, `minToHHMM`) | Puras y testeables |
| Traducción | `translation.js:39-75` | Independiente del layout |
| Listeners de Firebase | `comedor.html:1316-1373` | Separables del render |
| Lógica de cierre/turno | `comedor.html:615-777` | Reglas de negocio correctas |
| Relojes | `comedor.html:652-684` | Ya cumplen la Fase 4 |
| Estructura semántica de `createDishRow` | `comedor.html:1155-1209` | Reutilizable como "vista", parametrizada |
| Paleta, tipografías y aspecto general | `comedor.html:13-52, 461-487` | El diseño actual se mantiene |

### Sustituir (núcleo de la Fase 3)

1. `initDishPagination` + `calculatePages` + `measureAverageDishHeight` + `fitDishText`
   (`comedor.html:936-1152, 1212-1259`) → **motor único** `layout-engine.js`.
2. `flex: 1 1 0` de `.dish-row` → filas con **altura medida** dentro de un viewport medido.
3. Todo `line-clamp` / `ellipsis` en platos → prohibido; medir y repaginar.
4. Tamaños fijos `vmin`/vh de elementos de plato → derivados de una **escala de página** única.
5. El motor duplicado de `comidas_especiales.html:200-281` → consumir el módulo común.
6. El estado "Comedor cerrado" → reducir a logo + marca + título ES/EN + hora (§3.8, Fase 4).

---

## 7. Datos y aislamiento de producción

- `firebase-config.js:8-21` apunta al proyecto de **producción**
  `foodservice-alergenos-5fe9b` (`databaseURL: ...-default-rtdb.europe-west1...`).
- `gestion.html` **escribe** en `menu/comedor`, `turnos`, `recordatorios`, `cierreComedor`
  (`gestion.html:1165, 1577, 1588, 842`). Nunca debe apuntar a producción desde la preview.
- `comedor.html` solo **lee**.
- **No puedo crear un proyecto Firebase automáticamente**: requiere consola/Firebase CLI con
  autenticación de Google, que no está disponible. Por tanto la preview usará **datos mock/locales**
  (JSON versionado + capa de datos conmutable) para probar el layout. Ver decisión pendiente §9.

---

## 8. Plan de fases (2–6) propuesto

- **Fase 2 — Copia funcional.** Repo `foodservice-alergenos-preview`, copia 1:1 de la app actual.
  Verificación: comparar capturas producción vs preview **sin cambios** en 1280×720, 1920×1080,
  2560×1440, 3840×2160. Commit.
- **Fase 3 — Motor nuevo.** `layout-engine.js` compartido (medición → layout → paginación →
  escala por búsqueda binaria con `MIN_SCALE/MAX_SCALE/SAFETY_MARGIN` → validación), consumido por
  comedor y comidas especiales. Commit por hito.
- **Fase 4 — Comedor cerrado.** Reducir el overlay a logo + "FOOD SERVICE DPT" + "COMEDOR CERRADO"
  + "DINING ROOM CLOSED" + hora grande. Reloj sigue vivo. Commit.
- **Fase 5 — `debug-layout.html`.** Matriz 1/2/4/6/8/10/12/16/20 × perfiles de contenido, con
  panel de métricas: escala, páginas, overflow H/V, elementos fuera de contenedor, texto truncado.
- **Fase 6 — Tests.** Automatizados sobre los contenedores críticos
  (`scrollWidth <= clientWidth`, `scrollHeight <= clientHeight`, sin clipping/overlap/truncado/scroll)
  en las tres resoluciones objetivo.

Cada fase: tests → revisión de errores → commit → documentación, sin mezclar fases.

---

## 9. Decisiones pendientes (requieren tu aprobación)

1. **Estado de origen a copiar.** El repo tiene cambios **sin commitear** (incluido
   `fitDishText()` y el aumento de la leyenda). ¿Copio el **árbol de trabajo** (lo que estás
   editando ahora) o exactamente **HEAD `23bd66c`** (lo que ve España en producción)?
   *Recomendación:* árbol de trabajo como base de desarrollo, dejando constancia de la diferencia.
2. **Creación del repositorio.** Tengo `gh` autenticado como `foodservicedpt-stack` con scopes
   `repo` y `workflow`, así que **sí puedo** crear `foodservice-alergenos-preview` y activar
   GitHub Pages automáticamente. ¿Lo hago?
3. **Firebase de la preview.** Al no poder crear un proyecto Firebase automáticamente, propongo
   **modo mock local** con la capa de datos conmutable. ¿De acuerdo, o prefieres crear tú un
   proyecto de desarrollo y pasarme las credenciales?
4. **Alcance de la preview.** ¿Solo pantallas de lectura (comedor, comidas especiales, desayuno,
   debug/test) o también `gestion.html`? Incluir gestión exige garantizar que **nunca** escriba
   en producción.

---

## 10. Verificación de que el repositorio original no se ha tocado

- No se ha ejecutado ningún comando de escritura (`git add/commit/push`, edición) en
  `/Users/rmora/foodservice-alergenos`.
- La auditoría se ha redactado en `/Users/rmora/foodservice-alergenos-preview/`, **fuera** del repo original.
- Servir el repo en `localhost:8777` fue **solo lectura** y con Firebase **bloqueado** en el navegador.
- `git status` del original sin cambios respecto al inicio de la sesión.

---

## 11. Anexo — evidencia reproducible

**Capturas obtenidas**
- `/tmp/prod_comedor_1920.png` — producción, estado "Comedor cerrado" a 1920×1080 (muestra los textos a eliminar).
- `/tmp/prod_comidas_1920.png` — producción, `comidas_especiales.html`.
- `/tmp/stress_12_extreme_1920.png` — 12 platos con nombres largos y 14 alérgenos: nombres recortados ("A DE…", "A LA…"), etiquetas cortadas ("RAZAS"), iconos solapados y **ninguna paginación**.
- `/tmp/stress_8_1280x720.png` — 8 platos a 1280×720.

**Medición vía Chrome DevTools Protocol** (scripts en `/tmp/cdp_measure.mjs`, `/tmp/cdp_matrix.mjs`,
`/tmp/cdp_res.mjs`, `/tmp/cdp_local.mjs`): inyección de platos en el DOM, `initDishPagination()`
y lectura de `scrollHeight/clientHeight/scrollWidth/clientWidth` y `getBoundingClientRect()`.
Ninguna escritura en Firebase.

**Referencias de despliegue**
- Producción: `https://foodservicedpt-stack.github.io/foodservice-alergenos/` (Pages `build_type: workflow`, estado `built`, último run `32964695425` sobre `main`).
- Preview prevista: `https://foodservicedpt-stack.github.io/foodservice-alergenos-preview/` (pendiente de aprobación).
