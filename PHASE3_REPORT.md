# FASE 3 — Nuevo motor de layout determinista

**Fecha:** 2026-09-10
**Ámbito:** `comedor.html` y `comidas_especiales.html` (en la preview)
**Módulo nuevo:** `layout-engine.js` (compartido, sin dependencias)

---

## Objetivo

Sustituir el layout actual (basado en flex-shrink + `line-clamp`) por un sistema determinista:
**medición real + layout engine + pagination engine + escala adaptativa + validación**, con la regla
absoluta de no cortar, ocultar, desbordar ni solapar contenido.

---

## Qué se ha construido

### `layout-engine.js`

Motor reutilizable con una única clase `LayoutEngine.Engine`:

| Constante | Valor | Significado |
|---|---|---|
| `MIN_SCALE` | 0.50 | Suelo duro: nunca se baja de aquí |
| `LEGIBILITY_FLOOR` | 0.85 | Suelo blando: no se baja de aquí solo por ahorrar páginas |
| `MAX_SCALE` | 1.40 | Techo de legibilidad |
| `SAFETY_MARGIN` | 0.985 | Margen de seguridad sobre el alto útil |
| `SCALE_PRECISION` | 0.005 | Precisión de la búsqueda binaria |

**Algoritmo (`layout()`):**

1. **Medición real.** Crea una sonda oculta del mismo ancho que el contenedor, renderiza cada fila a
   tamaño natural (sin flex-shrink) y mide con `getBoundingClientRect()`. No estima: mide.
2. **Escala por búsqueda binaria.** Busca la **mayor escala válida** en `[MIN_SCALE, MAX_SCALE]`. Una
   escala es válida si ninguna fila desborda su página ni el ancho disponible (incluidos alérgenos,
   trazas, etiquetas e iconos, que ahora participan del cálculo).
3. **Minimización de páginas.** Si bajar la escala hasta `LEGIBILITY_FLOOR` reduce el número de
   páginas, se busca por búsqueda binaria la mayor escala que logra ese mínimo. Solo se reduce escala
   cuando aporta algo.
4. **Paginación equilibrada.** Reparto por el **mínimo número de páginas** y equilibrado por altura
   mediante *split array largest sum* (búsqueda binaria sobre la suma máxima por página). No son
   bloques fijos: las páginas quedan equilibradas.
5. **Validación explícita (`validate()`).** Comprueba y reporta:
   `container-overflow-x/y`, `row-overflow-x/y`, `text-clipped` (solo si el elemento **realmente**
   recorta, es decir `overflow != visible`), `child-outside-row`, `blocks-overlap` y `row-overlap`.

### Cambios en las pantallas

- `.dish-row`: de `flex: 1 1 0; min-height: 0` (que **enmascaraba** el overflow) a `flex: 0 0 auto`;
  las filas pasan a tener su altura natural medida.
- **Eliminado todo `line-clamp` de nombres de plato** y su `overflow: hidden`.
- Nueva variable `--page-scale` aplicada **en el punto de uso** de cada tamaño (nombres, traducción,
  etiquetas, iconos, badges), de modo que la escala del motor afecta a todo el bloque de platos.
- `initDishPagination` reescrito para usar el motor; eliminados `measureAverageDishHeight`,
  `calculatePages`, `fitDishText` y `measureAvg`.
- Se conserva la rotación con puntos y la pausa al pasar el ratón.

---

## Verificación (medición real en navegador)

Matriz ejecutada con Chrome DevTools Protocol sobre la preview local, comprobando
`dishPagination.lastValidation.ok` (overflow, recorte, solape, elementos fuera) y
`mainCol.scrollWidth/Height` frente a `clientWidth/Height`.

### Contenido extremo (nombres muy largos + 14 alérgenos + 14 trazas)

| Resolución | 1 | 2 | 4 | 6 | 8 | 10 | 12 | 16 | 20 |
|---|---|---|---|---|---|---|---|---|---|
| 1280×720 | OK | OK | OK | OK | OK | OK | OK | OK | OK |
| 1920×1080 | OK | OK | OK | OK | OK | OK | OK | OK | OK |
| 2560×1440 | OK | OK | OK | OK | OK | OK | OK | OK | OK |
| 3840×2160 | OK | OK | OK | OK | OK | OK | OK | OK | OK |

### Contenido realista (10 platos variados, 1920×1080)

Resultado: **5 platos en la página 1, escala 0.867, 2 páginas equilibradas `[5,5]`, sin overflow.**
Antes, con 8 platos, el octavo se recortaba a `"ENSALADA TEMPLADA DE…"`.

### Ambas pantallas

`comedor.html` y `comidas_especiales.html` pasan la matriz en las 4 resoluciones, incluido el caso
vacío (`n = 0`), sin errores de JavaScript.

---

## Límites conocidos / pendiente

- El **`line-clamp` del carousel de turno** (mensaje de despedida) sigue existiendo: no pertenece al
  layout de platos. Se revisará en la Fase 4.
- El motor aún no está integrado en el **repositorio de producción** (requiere aprobación explícita).
- Los tests automatizados formales son la **Fase 6**; aquí se ha usado la validación interna del motor.
- El panel de gestión sigue fuera de la preview.

---

## Commits

- `4f1bbb4` — Fase 2: copia aislada.
- `482bbed` — Fase 2: informe y paridad.
- (siguiente) Fase 3: motor `layout-engine.js` + integración en comedor y comidas especiales.
