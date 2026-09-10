# FASE 5 — Herramienta interna `debug-layout.html`

**Fecha:** 2026-09-10
**Archivo:** `debug-layout.html` (preview)

---

## Qué permite

- **Cantidades de platos:** 1, 2, 4, 6, 8, 10, 12, 16, 20 (botones).
- **Contenidos:** nombres cortos, nombres muy largos, traducción muy larga, muchos alérgenos,
  muchas trazas y combinación extrema.
- **Resoluciones:** 1280×720, 1920×1080, 2560×1440, 3840×2160.
- **Matriz completa (1–20)** de una sola pasada.

## Qué muestra

| Métrica | Descripción |
|---|---|
| Escala calculada | La que devuelve el motor (`--page-scale`) |
| Número de páginas | Y el reparto por página (p. ej. `5+5`) |
| Overflow horizontal | `scrollWidth > clientWidth` en el contenedor |
| Overflow vertical | `scrollHeight > clientHeight` en el contenedor |
| Elementos fuera | `child-outside-row` detectados por el validador |
| Texto truncado | `text-clipped` (solo cuando el elemento realmente recorta) |
| Validación | `ok` = sin ningún problema |

## Cómo funciona

Carga `comedor.html` en un `<iframe>` dimensionado exactamente a la resolución elegida y ejecuta
el motor **real** dentro del iframe (`initDishPagination`). Mide con el validador del propio motor y
con `scrollWidth/scrollHeight`. La vista se puede ajustar al panel sin alterar la medición, porque
la escala CSS solo afecta a la pintura del iframe, no a su viewport de layout.

## Verificación

Matriz completa ejecutada en 1920×1080 con contenido extremo: **9/9 casos OK**, sin overflow, sin
elementos fuera, sin texto truncado y sin errores de JavaScript.

---

## Pendiente

- La herramienta es de uso interno; no está enlazada desde el índice de la preview para no
  confundir al usuario final (se accede por URL directa `/debug-layout.html`).
