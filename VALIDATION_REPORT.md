# VALIDACIÓN VISUAL DE LA PREVIEW — informe

> **Nota (auditoría final).** Las cifras de menús de 12 platos de este informe corresponden a
> **tres datasets distintos** (verificación del defecto, tabla del menú y test de resize), por lo
> que no eran comparables entre sí. La traza completa y el resultado unificado con el fixture único
> `MENU12_CANONICAL` están en **`AUDIT_FINAL_REPORT.md` §1**.

**Fecha:** 2026-09-10
**Alcance:** solo la preview. **No se ha integrado nada ni tocado producción.**

---

## 1. Resultado de las pruebas

### Suite automatizada

```
node tests/run-layout-tests.mjs

MATRIZ DE LAYOUT: casos = 584 | fallos = 0
PRUEBA DE RESIZE:  fallos = 0
TODOS LOS TESTS PASAN
```

Cobertura de la matriz: 2 pantallas × 4 resoluciones (**1280×720, 1920×1080, 2560×1440,
3840×2160**) × 9 escenarios (A–H + menú de 12) × cantidades 1–20. Cada caso comprueba
`scrollWidth <= clientWidth`, `scrollHeight <= clientHeight`, sin clipping, sin solape, sin
elementos fuera, sin scroll de documento y `unfit = false`.

### Prueba de resize

```
comedor  1280x720   escala=0.939 paginas=3+3+3+3 motores=1 OK
comedor  3840x2160  escala=0.85  paginas=4+4+4   motores=1 OK
comedor  2560x1440  escala=1.031 paginas=3+3+3+3 motores=1 OK
comedor  1920x1080  escala=1.014 paginas=3+3+3+3 motores=1 OK
comedor  1280x720   escala=0.939 paginas=3+3+3+3 motores=1 OK
comidas  1280x720   escala=0.88  paginas=4+3+1   motores=1 OK
comidas  3840x2160  escala=0.928 paginas=5+3     motores=1 OK
comidas  2560x1440  escala=0.867 paginas=5+3     motores=1 OK
comidas  1920x1080  escala=0.856 paginas=5+3     motores=1 OK
comidas  1280x720   escala=0.88  paginas=4+3+1   motores=1 OK
```

`motores=1` significa **una sola reconstrucción del motor por resize**: sin bucles, sin
reconstrucciones en cascada. Se comprueba además que las páginas resultantes son válidas
(ninguna vacía) y que no hay overflow ni clipping tras el cambio de tamaño.

### Menú extremo de 12 platos (el del encargo)

12 platos incluyendo *"GUISO TRADICIONAL DE GARBANZOS CON ESPINACAS, ZANAHORIA, CEBOLLA
CARAMELIZADA Y SALSA DE TOMATE CASERA"* y traducciones largas, con combinaciones variadas de
alérgenos y trazas:

| Resolución | Escala | Motivo | Páginas | Reparto | Overflow | Clip | Solape | Estado |
|---|---|---|---|---|---|---|---|---|
| 1280×720 | 0.848 | `content-limited` | 4 | 3+1+4+4 | no | 0 | 0 | OK |
| 1920×1080 | 0.911 | `max-scale` | 4 | 3+1+4+4 | no | 0 | 0 | OK |
| 2560×1440 | 0.922 | `max-scale` | 4 | 3+1+4+4 | no | 0 | 0 | OK |
| 3840×2160 | 0.999 | `max-scale` | 4 | 3+1+4+4 | no | 0 | 0 | OK |

**No se consiguió romper el layout**: en los 584 casos no hubo ni un solo overflow, recorte,
solape ni elemento fuera de contenedor.

---

## 2. Problemas encontrados (y corregidos en la preview)

### Defecto 1 — La minimización de páginas podía no aplicarse (real, corregido)

**Síntoma:** en 4K, un menú de 12 platos se repartía en **8 páginas** (1–2 platos por página) en
vez de en 3, pese a que el motor había medido que a escala 0.85 cabía en 3.

**Causa:** en `layout()`, cuando el mínimo de páginas se alcanza en un margen de escala **más
estrecho que `SCALE_PRECISION` (0.005)**, la búsqueda binaria no muestrea ninguna escala que
logre ese mínimo. La variable `scale` solo se actualizaba al encontrar una candidata válida, así
que se quedaba en `sMax` (la escala máxima) sin aplicar el ahorro de páginas.

**Corrección:** inicializar la búsqueda en `floorScale`, que ya se ha medido y **logra el mínimo**
por construcción. Si la búsqueda no encuentra nada mejor, se usa `floorScale`.

**Verificación:** el caso 4K pasa de 8 páginas (escala 1.365) a 3 páginas (escala 0.85), sin
overflow.

### Defecto 2 — El recálculo por resize no era determinista (real, corregido)

**Síntoma:** al redimensionar de una resolución pequeña a 4K, la escala y el número de páginas
diferían de los de una carga limpia en la misma resolución.

**Causas:** dos.
1. El manejador de `resize` recalculaba con un solo `requestAnimationFrame`, antes de que las
   unidades `vmin` estuvieran asentadas.
2. La altura reservada para el indicador de páginas dependía del estado previo (con o sin puntos),
   lo que cambiaba el alto útil en unos pocos píxeles.

**Corrección:** doble `requestAnimationFrame` con `cancelAnimationFrame` (debounce) en ambas
pantallas, y reserva de paginación con **estructura siempre idéntica**.

**Verificación:** tras los arreglos, carga limpia, resize y reinyección manual producen
**idéntica escala y reparto** (p. ej. 4K: 0.85 / 4+4+4 en los tres casos).

### Observación (no corregida) — Overflow decorativo en "Comedor cerrado"

El overlay de cierre reporta `scrollWidth 2043 > 1920` y `scrollHeight 1698 > 1080`. La causa es
**exclusivamente el pseudo-elemento decorativo** `.cierre-card::before` (el halo radial), que se
extiende 180 px a la derecha y 675 px hacia abajo y queda recortado por `overflow:hidden`.

- **Ningún elemento de contenido está fuera**: la comprobación de los elementos reales del overlay
  da lista vacía.
- No afecta a la legibilidad ni a la posición: la captura confirma el centrado correcto.
- **No se ha modificado** porque esta fase es de validación y el efecto es puramente decorativo.
  Si quieres un cierre con overflow estrictamente 0, la corrección es sustituir ese pseudo-elemento
  por una capa de `background: radial-gradient(...)` en el propio overlay (mismo aspecto, sin
  overflow). Dime si lo aplico.

---

## 3. El sistema MIN_SCALE / LEGIBILITY_FLOOR / MAX_SCALE

Detalle completo en `SCALE_SYSTEM.md`. Resumen:

| Constante | Valor | Responsabilidad |
|---|---|---|
| `MIN_SCALE` | 0.50 | **Suelo duro**: mínima escala que el motor puede proponer. Último recurso. |
| `LEGIBILITY_FLOOR` | 0.85 | **Suelo blando** del paso de ahorro de páginas: no se baja de aquí *voluntariamente*. |
| `MAX_SCALE` | 1.40 | **Techo**: máxima legibilidad; punto de partida de la búsqueda binaria. |

**Cuando una página no cabe a 0.85:** no es un caso especial. 0.85 no es un suelo de validez; si
una fila no cabe a 0.85, entonces la mayor escala válida ya es menor. El paso de ahorro de páginas
no se ejecuta y la escala final es esa mayor escala válida (motivo `content-limited`). **Bajar de
0.85 solo ocurre cuando el contenido lo exige.**

**Cuando no cabe a 0.50:** no existe escala válida. Se usa 0.50 como último recurso, cada fila
ocupa su propia página y **sí hay overflow** (motivo `unfit-min-scale`, `unfit = true`). Es el
**único** caso en que la regla de "nunca overflow" no puede cumplirse; ahora se expone de forma
explícita en el resultado del motor y en `validate()` en vez de quedar en silencio.

**¿Hay rutas a 0.50 sin motivo?** No. Por debajo de 0.85 solo hay dos rutas: `content-limited`
(una fila no cabe a 0.85) y `unfit-min-scale` (nada cabe a 0.50). Ambas quedan registradas con su
motivo. **En los 584 casos probados no se alcanzó ninguna vez `unfit-min-scale`.**

---

## 4. URL de preview

**https://foodservicedpt-stack.github.io/foodservice-alergenos-preview/**

- Comedor: `/comedor.html`
- Comidas especiales: `/comidas_especiales.html`
- Herramienta de validación: **`/debug-layout.html`**

---

## 5. Instrucciones para probar manualmente los casos extremos

1. Abre **`/debug-layout.html`**.
2. En **Escenario**, elige `MENÚ 12 PLATOS · caso extremo`.
3. En **Resolución**, prueba las cuatro (1280×720, 1920×1080, 2560×1440, 3840×2160).
4. Pulsa **Ejecutar**: el panel derecho muestra escala, motivo, páginas, platos por página,
   overflow, clipping, solapamientos y elementos fuera.
5. Pulsa **Matriz 1–20** para barrer todas las cantidades (con el menú de 12 se ejecuta el caso de 12).
6. Pulsa **Probar resize** para recorrer 1920 → 2560 → 1280 → 3840 → 1920 y ver que en cada paso
   no hay overflow, el clipping es 0 y se reconstruye **un solo** motor.
7. Repite con los escenarios **B, C, D, E, F, H** para los distintos tipos de contenido.
8. Para el estado cerrado: edita `mock-data.js` → `'cierreComedor': { activo: true }` (o pídelo y
   lo dejo activado) y abre `/comedor.html`.

---

## 6. Repositorio de producción

Intacto: `main` en `23bd66c`, `0 0` frente a `origin/main`, mismo hash de estado del árbol, y su
GitHub Pages responde 200. **No se ha hecho merge, PR ni push al repositorio original, ni se ha
tocado su Firebase.**
