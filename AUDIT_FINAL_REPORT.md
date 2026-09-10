# AUDITORÍA FINAL PREVIA A INTEGRACIÓN

**Fecha:** 2026-09-10
**Ámbito:** exclusivamente la preview. **No se ha tocado producción**: `main` en `23bd66c`,
`0 0` frente a `origin/main`, sin merge, sin PR, sin push al repositorio original, sin tocar su Firebase.

---

## 1. La inconsistencia del menú de 12 platos: trazada y resuelta

### Diagnóstico: no era un bug del motor, eran TRES datasets distintos

Los tres resultados del informe anterior venían de **tres menús diferentes**. Bajo el motor actual,
a 3840×2160, la traza completa es:

| Dataset | Nº | sMax | floorScale | pTop (a sMax) | pFloor (a floor) | Escala final | Motivo | Reparto | Fila máx / útil |
|---|---|---|---|---|---|---|---|---|---|
| `legacy-defecto` (verificación del bug) | 12 | 1.3648 | 0.85 | 8 | **3** | **0.85** | `pages-minimized` | **4+4+4** | 455 / 1517 |
| `MENU12_v1` (tabla del informe) | 12 | 0.9992 | 0.85 | 4 | 4 | **0.9992** | `max-scale` | **3+1+4+4** | 1427 / 1517 |
| `G12` (test de resize) | 12 | 1.3648 | 0.85 | 8 | **3** | **0.85** | `pages-minimized` | **4+4+4** | 455 / 1517 |
| `MENU12_CANONICAL` (fixture actual) | 12 | 0.9219 | 0.85 | 6 | 4 | **0.877** | `pages-minimized` | **4+2+4+2** | 1166 / 1517 |

A 1920×1080:

| Dataset | sMax | floorScale | pTop | pFloor | Escala final | Motivo | Reparto |
|---|---|---|---|---|---|---|---|
| `legacy-defecto` | 1.2312 | 0.85 | 8 | 4 | 1.0138 | `pages-minimized` | 3+3+3+3 |
| `MENU12_v1` | 0.9113 | 0.85 | 4 | 4 | 0.9113 | `max-scale` | 3+1+4+4 |
| `G12` | 1.2312 | 0.85 | 8 | 4 | 1.0138 | `pages-minimized` | 3+3+3+3 |
| `MENU12_CANONICAL` | 0.8375 | 0.8375 | 6 | 6 | 0.8375 | `content-limited` | 4+1+2+3+1+1 |

**Por qué diferían:**

- La **verificación del bug** usaba un menú de 12 con 4 platos largos (`LONG_ES`/`LONG_EN` + 4 alérgenos
  + 4 trazas) y 8 cortos ("CROQUETAS"). A 4K: `sMax=1.365` daba **8 páginas**, pero a 0.85 cabía en **3**
  → aquí actuaba la minimización de páginas (y antes del arreglo, no se aplicaba: se quedaba en 8).
- La **tabla del informe** usaba `MENU12_v1`, un menú distinto (12 platos variados, ninguno tan alto):
  a 4K `sMax=0.9992` daba ya **4 páginas** y a 0.85 también 4 → `pFloor == pTop`, no había nada que
  ahorrar y se quedaba en `max-scale` con **3+1+4+4**. **Este caso nunca estuvo afectado por el bug.**
- El **test de resize** usaba el escenario `G12`, prácticamente igual a `legacy-defecto` a 4K → 4+4+4.

La causa del aparente conflicto es, por tanto, **comparar menús diferentes como si fueran el mismo**.
No hay un bug pendiente en el motor: el defecto real (minimización no aplicada cuando el umbral es
más estrecho que `SCALE_PRECISION`) se corrigió, y la prueba de resize determinista lo confirma.

### Corrección del test

Se ha eliminado la causa raíz: **ya no hay datasets ad-hoc**. Existe un único fixture compartido
(`fixtures.js` → `MENU12_CANONICAL`) que usan el debug, los tests y esta documentación.

### Resultado inequívoco con el fixture canónico

| Resolución | sMax | floorScale | pTop | pFloor | Escala | Motivo | Reparto | Overflow | Clip | Solape | Fuera |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1280×720 | 0.7707 | 0.7707 | 6 | 6 | **0.7707** | `content-limited` | 4+1+2+3+1+1 | no | 0 | 0 | 0 |
| 1920×1080 | 0.8375 | 0.8375 | 6 | 6 | **0.8375** | `content-limited` | 4+1+2+3+1+1 | no | 0 | 0 | 0 |
| 2560×1440 | 0.8480 | 0.8480 | 6 | 6 | **0.8480** | `content-limited` | 4+1+2+3+1+1 | no | 0 | 0 | 0 |
| 3840×2160 | 0.9219 | 0.85 | 6 | 4 | **0.8770** | `pages-minimized` | 4+2+4+2 | no | 0 | 0 | 0 |

---

## 2. Fixture único `MENU12_CANONICAL`

Definido en **`fixtures.js`** (UMD: lo cargan navegador y Node). 12 platos con nombres largos ES,
traducciones largas, hasta 14 alérgenos y 14 trazas, combinaciones variadas, platos cortos y largos,
y uno extremadamente largo (el nº 11: "CREMA DE CALABAZA ASADA…" con 14 + 14). El nº 5 es el nombre
pedido en el encargo ("GUISO TRADICIONAL DE GARBANZOS…").

Se usa en: `debug-layout.html`, `tests/run-layout-tests.mjs` y esta documentación. **Una sola fuente.**

---

## 3. Test de resize determinista

MENU12_CANONICAL. Se compara la **carga limpia** en cada resolución con el resultado **tras
1920 → 2560 → 1280 → 3840 → 1920**, comparando escala, sMax, floorScale, motivo, páginas, reparto,
overflow, clipping, solapes y elementos fuera:

```
1920x1080=igual · 2560x1440=igual · 1280x720=igual · 3840x2160=igual
```

Idénticos en las 4 resoluciones. Además, **una sola reconstrucción del motor por resize** (sin bucles).

---

## 4. Test de cambios de contenido (sin recargar)

Secuencia 1 → 4 → 8 → 12 → 20 → MENU12 → H → 1:

```
n=1→e1.2312,p1 · n=4→e1.1568,p2+2 · n=8→e1.0138,p3+3+2 · n=12→e1.0138,p3+3+3+3
n=20→e1.0138,p3+3+3+3+3+3+2 · MENU12→e0.8375,p4+1+2+3+1+1 · H→e0.7355,p(12) · n=1→e1.2312,p1
reproducible = true
```

El primer "1 plato" y el último "1 plato" producen **exactamente** el mismo resultado.

---

## 5. Test de caso imposible

Plato con nombre de ~1670 caracteres + 14 alérgenos + 14 trazas:

```
unfit=true · reason=unfit-min-scale · ok=false · data-layout-unfit=true
problems={"container-overflow-y":1} · motores=1 · 28 ms · report.unfit=true
```

- Se marca explícitamente (`unfit`, `reason`, `validate().ok = false`, atributo `data-layout-unfit`).
- **No se presenta como layout válido** y **no se oculta**: se registra con `console.error`.
- **Sin bucle** (una sola construcción del motor) y sin cuelgue (28 ms).
- No se ha modificado `MIN_SCALE` ni se ha introducido `emergency-scale`.

---

## 6. Estado "Comedor cerrado" (automatizado)

```
textos=["Food Service DPT","COMEDOR CERRADO","DINING ROOM CLOSED","20:44"]
prohibidos=[] · ticks=4 (en 2,6 s) · turnoOpacity=0
```

Únicos textos visibles: los 4 exigidos. **No** aparece "El comedor está cerrado", "The dining room
is closed", "HORA ACTUAL" ni "CURRENT TIME". El overlay de turno (y su carousel) está a opacidad 0:
el cierre no usa carousel. El reloj sigue actualizándose.

---

## 7. Overflow decorativo del cierre: corregido

Se sustituyó el pseudo-elemento `.cierre-card::before` por una **capa de background**
(`radial-gradient` en `#cierre-overlay`), con el mismo aspecto. Resultado:

```
scrollW=1920 clientW=1920 · scrollH=1080 clientH=1080
```

`scrollWidth === clientWidth` y `scrollHeight === clientHeight` en el estado cerrado.

---

## 8. Cobertura del desayuno

`desayuno.html` **no usa `layout-engine.js`**: no referencia `LayoutEngine`, no tiene
`.dish-row`/`initDishPagination` y construye su propia ficha A4 con `.print-dish-row`. Por eso
queda **fuera del alcance** de la matriz del motor. Se añadió un smoke test propio:

```
NO usa layout-engine. print-dishes={sw:723,cw:723,sh:610,ch:610}
print-layout={sw:1002,cw:1002,sh:610,ch:610}
```

Sin overflow en sus contenedores de impresión.

---

## 9. Assertions estrictas (añadidas)

Además de `scrollWidth <= clientWidth` y `scrollHeight <= clientHeight`, cada caso comprueba:
elementos fuera del viewport, `boundingClientRect`, clipping real (solo si `overflow != visible`),
texto truncado, altura de fila (>0 y ≤ alto del contenedor), iconos fuera de su fila, solape entre
bloques y entre filas, páginas vacías, **pérdida de platos** (suma de páginas === nº de entrada) y
**filas renderizadas === platos de la página actual**. En resize: páginas válidas y motores acotados.

---

## 10. Tabla final

| TEST | RESULTADO | EVIDENCIA |
|---|---|---|
| Matriz de layout (A–H + MENU12, 4 resoluciones, 1–20) | **PASS** | 584 casos, 0 fallos, 0 overflow/clip/solape/fuera |
| MENU12_CANONICAL en carga limpia (4 resoluciones) | **PASS** | 1280: 0.7707 4+1+2+3+1+1 `content-limited` · 1920: 0.8375 · 2560: 0.848 · 3840: 0.877 4+2+4+2 |
| Resize determinista (carga limpia vs 1920→2560→1280→3840→1920) | **PASS** | Idénticos en las 4 resoluciones |
| Cambios de contenido sin recargar y vuelta a 1 plato | **PASS** | 8 pasos, reproducible=true |
| Caso imposible (no cabe ni a MIN_SCALE) | **PASS** | unfit=true, reason=unfit-min-scale, ok=false, data-layout-unfit=true, 1 motor, 28 ms |
| Estado "Comedor cerrado" (textos, sin carousel, reloj vivo) | **PASS** | 4 textos exactos, prohibidos=[], ticks=4, turnoOpacity=0 |
| Overflow decorativo del cierre (scroll === client) | **PASS** | scrollW=1920=clientW, scrollH=1080=clientH |
| Cobertura del desayuno | **PASS** | No usa layout-engine (documentado); sin overflow en impresión |
| MENU12_CANONICAL exige escala < 0.85 en ≤1440p | **WARN** | `content-limited` 0.77–0.848: es el plato extremo del fixture; comportamiento previsto, no defecto, pero reduce la legibilidad de ese menú |
| Estado `unfit` solo visible por consola/atributo | **WARN** | En la TV real un contenido imposible haría overflow sin aviso visual; el motor lo expone, pero no hay señal en pantalla |

**TOTAL: PASS = 8 · WARN = 2 · FAIL = 0**

### WARN explicados

1. **Escala < 0.85 en menús extremos.** No es un fallo del motor: es la ruta `content-limited`
   (documentada en `SCALE_SYSTEM.md`), que solo se activa cuando una fila no cabe ni a 0.85. Con el
   fixture canónico (que incluye a propósito un plato extremadamente largo y otro con 14+14) ocurre
   en 1280/1920/2560. Decisión de producto: aceptar la escala menor o limitar el contenido real.
2. **`unfit` sin aviso visual en pantalla.** El motor y el DOM lo marcan y la consola lo registra,
   pero la pantalla del comedor no muestra ninguna señal. Para producción convendría decidir si se
   añade un aviso (no implementado: esta misión no añade funcionalidades).

---

## 11. Criterio final

**B) LISTA CON RESERVAS**

El motor de layout está listo: 584 casos sin fallos, resize **determinista** con una sola
reconstrucción por cambio, cambios de contenido reproducibles, caso imposible detectado y explícito,
cierre sin overflow y sin textos indebidos, y assertions estrictas. Las dos reservas son **decisiones
de producto** (aceptar `content-limited` en menús extremos y decidir si el estado `unfit` debe tener
aviso visual), no defectos abiertos del motor.
