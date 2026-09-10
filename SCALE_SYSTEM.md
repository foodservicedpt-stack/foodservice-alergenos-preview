# Sistema de escala — MIN_SCALE / LEGIBILITY_FLOOR / MAX_SCALE

Documento de análisis del comportamiento real de `layout-engine.js`. **No modifica el
comportamiento**: describe lo que hace hoy y expone los motivos.

---

## 1. Qué significa cada constante

| Constante | Valor | Qué es | Qué NO es |
|---|---|---|---|
| `MIN_SCALE` | 0.50 | **Suelo duro** de la búsqueda de validez. La mayor escala válida (`sMax`) se busca en `[MIN_SCALE, MAX_SCALE]`. El motor nunca *propone* una escala menor. Si nada es válido, cae a `MIN_SCALE` como último recurso. | No es una escala "de trabajo" ni un objetivo. Solo se alcanza cuando nada más cabe. |
| `LEGIBILITY_FLOOR` | 0.85 | **Suelo blando** exclusivo del paso de *minimización de páginas*. Limita cuánto está dispuesto el motor a reducir la escala **voluntariamente** para ahorrar páginas. | **No es un suelo global.** No impide que la escala quede por debajo de 0.85 cuando el propio contenido lo exige. |
| `MAX_SCALE` | 1.40 | **Techo**. Punto de partida de la búsqueda y máxima legibilidad permitida. | No es un objetivo obligatorio: si el contenido no cabe a 1.40, la escala baja. |

`SAFETY_MARGIN` (0.985) es un margen de seguridad sobre el alto útil: una fila es "válida" si
`alto_fila ≤ alto_útil × 0.985`.

---

## 2. Cómo se calcula la escala (paso a paso)

1. **Validez.** Una escala `s` es válida si, medida la fila más alta a esa escala:
   - `alto_fila_max ≤ alto_útil × SAFETY_MARGIN`, y
   - ninguna fila desborda horizontalmente.

2. **`sMax` — mayor escala válida.** Se prueba primero `MAX_SCALE`. Si es válida, `sMax = MAX_SCALE`.
   Si no, **búsqueda binaria** en `[MIN_SCALE, MAX_SCALE]` (precisión 0.005, ~9 iteraciones) para
   hallar la mayor escala válida.
   - Si **ninguna** escala del rango es válida → `sMax` no existe.

3. **`floorScale` — suelo del paso de páginas.**
   ```
   floorScale = min(sMax, max(MIN_SCALE, LEGIBILITY_FLOOR))
   ```

4. **Minimización de páginas** (solo si `floorScale < sMax`, es decir, si `sMax > 0.85`):
   - `pTop` = páginas a `sMax`; `pFloor` = páginas a `floorScale` (0.85).
   - Si `pFloor < pTop`, búsqueda binaria de la **mayor** escala en `[0.85, sMax]` que logra
     `pFloor` páginas. Esa es la escala final.
   - Si no se ahorra ninguna página, se queda en `sMax`.

5. **Paginación equilibrada** por altura a la escala final
   (*split array largest sum*), minimizando el número de páginas y equilibrando su ocupación.

---

## 3. ¿Qué ocurre cuando una página no cabe a 0.85?

No es un caso especial: 0.85 **no es un suelo de validez**. Si una fila no cabe a 0.85, entonces
`sMax < 0.85` (la mayor escala válida ya está por debajo). En ese caso:

- `floorScale = min(sMax, 0.85) = sMax`, así que la condición `floorScale < sMax` es falsa
  y **el paso de minimización de páginas ni se ejecuta**.
- La escala final es `sMax`: la mayor que hace caber el contenido, aunque esté por debajo de 0.85.
- **Motivo registrado:** `content-limited`.

Es decir: bajar de 0.85 **solo** ocurre cuando el contenido no cabe a 0.85. No hay ninguna ruta
en la que el motor baje de 0.85 para ahorrar páginas.

---

## 4. ¿Qué ocurre cuando no cabe a 0.50?

`sMax` no existe (`best = null`). El motor usa `MIN_SCALE` (0.50) como **último recurso**:

- `scale = 0.50`.
- `_paginate` encuentra que cada fila excede la capacidad → devuelve una página por fila.
- La fila **sigue desbordando**: `validate()` reporta `container-overflow-y` / `row-overflow-y`.
- **Motivo registrado:** `unfit-min-scale`, y `unfit = true`.

Este es el **único caso en el que la regla absoluta de "nunca overflow" no puede cumplirse**.
Hasta ahora solo se avisaba por `console.warn`; ahora el resultado del motor lo expone de forma
explícita (`reason: 'unfit-min-scale'`, `unfit: true`) y `validate()` lo incluye.

> Limitación conocida de ese estado: con `sMax` inexistente, la paginación se calcula con una
> capacidad menor que la altura real de las filas, por lo que puede agrupar más de una fila
> gigante por página. Sigue habiendo overflow en cualquier caso.

---

## 5. Las únicas rutas por debajo de 0.85

| Motivo (`reason`) | Escala | Condición | ¿Explicable? |
|---|---|---|---|
| `max-scale` | 1.40 | Cabe a 1.40 y no se ahorran páginas bajando | — |
| `pages-minimized` | 0.85 … 1.40 | Se baja (nunca por debajo de 0.85) para ahorrar páginas | — |
| `content-limited` | 0.50 … 0.85 | **Una fila no cabe a 0.85** | Sí: es la mayor escala que hace caber el contenido |
| `unfit-min-scale` | 0.50 | **Nada cabe ni a 0.50** | Sí, pero en este caso hay overflow: requiere decisión de producto |

**Conclusión:** no existe una ruta lógica que muestre contenido a 0.50 mientras el contenido
quepa a 0.85. Las dos rutas que bajan de 0.85 tienen motivo explícito y ya se registran en el
resultado del motor y en `validate()`.

---

## 6. Recomendación pendiente (sin aplicar)

El caso `unfit-min-scale` es el único que rompe la regla de "nunca overflow". Opciones, a decidir
antes de integrar:

1. **Aceptarlo y hacerlo visible** (estado actual mejorado): `unfit = true` → la pantalla podría
   mostrar un aviso o el `debug-layout` marcarlo en rojo. No cambia el layout.
2. **Permitir un último recurso por debajo de 0.50** solo para la fila que no cabe, registrándolo
   como `emergency-scale`. Rompe la semántica de `MIN_SCALE`.
3. **Reducir el problema en origen** (contenido): limitar número de alérgenos/trazas por plato o
   acortar nombres, para que nunca se llegue ahí.

No se ha implementado ninguna: primero hay que decidir.
