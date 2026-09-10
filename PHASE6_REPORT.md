# FASE 6 — Tests automatizados de layout

**Fecha:** 2026-09-10
**Ubicación:** `tests/run-layout-tests.mjs` (+ `tests/README.md`)
**Ejecución:** `node tests/run-layout-tests.mjs`

---

## Qué comprueba

En los contenedores críticos (`#main-col`, `.dish-row` y todos sus hijos):

- `scrollWidth <= clientWidth`
- `scrollHeight <= clientHeight`
- Sin **clipping** (`text-clipped`), sin **solape** (`row-overlap`, `blocks-overlap`)
- Sin **texto truncado**, sin **iconos fuera** (`child-outside-row`)
- Sin **scroll** en el documento (`documentElement`)
- Sin `container-overflow-x/y`

## Cobertura

| Dimensión | Valores |
|---|---|
| Páginas | `comedor.html`, `comidas_especiales.html` |
| Resoluciones | **1920×1080, 2560×1440, 3840×2160** |
| Contenidos | cortos, muy largos, traducción muy larga, muchos alérgenos, muchas trazas, extremo |
| Cantidades | 1, 2, 4, 6, 8, 10, 12, 16, 20 |
| **Total** | **324 casos** |

El runner arranca su propio servidor estático y su propio Chrome headless (sin dependencias ni
build) y devuelve código de salida 0/1.

---

## Resultado

```
CASOS: 324 | FALLOS: 0
TODOS LOS TESTS PASAN
```

Además, la matriz complementaria a **1280×720** (no exigida en la Fase 6) también pasa sin
incidencias ni errores de JavaScript.

---

## Defecto real encontrado y corregido por los tests

Los tests detectaron 3 fallos en el perfil "muchas trazas" a 1920×1080 (n = 2 y 4). Diagnóstico:

- La **sonda de medición** usaba `clientWidth` (entero, 1467 px).
- El **render real** tenía un ancho fraccionario (1466.90625 px).
- Esa diferencia de **0,1 px** hacía que un nombre largo partiese en una línea más en el render
  que en la medición → la fila crecía ~49 px y desbordaba el contenedor.

**Corrección** (`layout-engine.js`, `_metrics`): usar el ancho y el alto **fraccionarios**
(`getBoundingClientRect()` menos bordes y padding) en vez de `clientWidth/clientHeight`, que
redondean a entero. Tras el arreglo: **324/324 casos OK**.

Este es exactamente el tipo de fallo que la fase de tests debía atrapar antes de la integración.

---

## Límites conocidos

- Los tests cubren el **layout de platos**. No cubren el overlay de turno ni su carousel, ni el
  estado de cierre (que se verificó manualmente en la Fase 4).
- No hay CI configurado (el repositorio no tiene `package.json`); los tests se ejecutan a mano o
  desde cualquier automatización que invoque el comando.
- El runner necesita **Google Chrome** instalado.

---

## Archivos de esta fase

- `tests/run-layout-tests.mjs` — runner de los 324 casos.
- `tests/README.md` — cómo ejecutarlos y qué cubren.
- `debug-layout.html` — herramienta interactiva (Fase 5).
