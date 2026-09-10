# FASE 2 — Copia funcional aislada

**Fecha:** 2026-09-10
**Repositorio:** `foodservicedpt-stack/foodservice-alergenos-preview` (independiente)
**URL:** https://foodservicedpt-stack.github.io/foodservice-alergenos-preview/
**Commit base:** `4f1bbb4`

---

## Objetivo de la fase

Copiar la aplicación actual manteniendo el comportamiento visual y funcional, de forma que
**ORIGINAL** y **PREVIEW SIN CAMBIOS** se comporten igual, y demostrarlo con evidencia antes de
empezar la reingeniería (Fase 3).

---

## Qué se ha copiado

Origen: **árbol de trabajo** de `foodservice-alergenos` (rama `main`, HEAD `23bd66c`), tal y como
se acordó. Incluye los cambios locales aún sin commitear (`fitDishText()`, leyenda ampliada).

| Archivo | Estado |
|---|---|
| `comedor.html` | Copiado — solo cambia el bloque de scripts |
| `comidas_especiales.html` | Copiado — solo cambia el bloque de scripts |
| `desayuno.html` | Copiado — solo cambia el bloque de scripts |
| `allergen-data.js` | Copiado idéntico |
| `utils.js` | Copiado idéntico |
| `translation.js` | Copiado idéntico |
| `img/` | Copiado completo |

**No incluido por decisión de alcance:** `gestion.html` (es el único que escribe en Firebase),
`netlify/` y `netlify.toml` (proxy de traducción, no necesario para layout).

---

## Cambios respecto al original (mínimos y explícitos)

1. **Bloque de carga de scripts** en las tres pantallas. Se eliminan los dos scripts del SDK de
   Firebase (gstatic) y se añade `mock-data.js`:

   ```diff
   -  <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js"></script>
   -  <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js"></script>
   +  <!-- PREVIEW: SIN SDK de Firebase y SIN credenciales de produccion. -->
   +  <script src="./mock-data.js"></script>
      <script src="./firebase-config.js"></script>
   ```

2. **`firebase-config.js` sustituido**: ya no contiene credenciales. Implementa una base de datos
   en memoria que respeta la API usada por la app
   (`ref().on()/.off()/.once()/.set()/.update()/.push()`). Cualquier escritura se queda en
   `window.MOCK_DB`.
3. **Nuevos archivos:** `mock-data.js` (datos de prueba), `index.html` (lanzador sin gestión) y
   `README.md`.

El código de layout, CSS y JavaScript de las pantallas es **byte a byte el original**.

---

## Garantías de aislamiento verificadas

| Comprobación | Resultado |
|---|---|
| Credenciales de producción en la preview (`AIzaSy…`, `foodservice-alergenos-5fe9b`) | **Ninguna** (`grep` sin coincidencias) |
| Peticiones de red al cargar `comedor.html` desplegado | Solo `foodservicedpt-stack.github.io` (21 peticiones) |
| Peticiones a `firebaseio.com` / `firebaseapp.com` / `gstatic.com` | **Cero** |
| Excepciones JavaScript | **Ninguna** |
| Escrituras a base de datos remota | Imposibles: no hay SDK ni `databaseURL` |

---

## Verificación de paridad ORIGINAL vs PREVIEW

Método: se sirvieron ambas versiones en local, se inyectó **el mismo conjunto de 8 platos**
(nombres cortos y muy largos, alérgenos y trazas) y se comparó la geometría medida con
`getBoundingClientRect()` fila a fila (posición, tamaño, tipografía, bloque de alérgenos) más el
estado de paginación y los contenedores.

| Resolución | Resultado |
|---|---|
| 1280×720 | **IDÉNTICO** |
| 1920×1080 | **IDÉNTICO** |
| 2560×1440 | **IDÉNTICO** |
| 3840×2160 | **IDÉNTICO** |

> La preview reproduce fielmente el comportamiento actual, **incluidos sus defectos** (el 8.º plato
> se comprime y se recorta, los alérgenos se salen de su fila y no hay paginación). Ese es
> precisamente el punto de partida que la Fase 3 debe corregir.

---

## Cómo probar la preview

- Índice: https://foodservicedpt-stack.github.io/foodservice-alergenos-preview/
- Comedor: https://foodservicedpt-stack.github.io/foodservice-alergenos-preview/comedor.html
- Comidas especiales: https://foodservicedpt-stack.github.io/foodservice-alergenos-preview/comidas_especiales.html
- Ficha de desayuno: https://foodservicedpt-stack.github.io/foodservice-alergenos-preview/desayuno.html

Para ver el estado **"Comedor cerrado"**, edita `mock-data.js` → `'cierreComedor': { activo: true }`.

---

## Estado del repositorio de producción

`foodservice-alergenos` **no se ha modificado**: `main` y `origin/main` siguen en `23bd66c`,
sin commits ni push nuevos, y su GitHub Pages sigue intacto.

---

## Pendiente para la Fase 3

Sustituir por un motor determinista: medición real → layout engine → pagination engine → escala
adaptativa por búsqueda binaria (`MIN_SCALE`/`MAX_SCALE`/`SAFETY_MARGIN`) → validación, sin
`line-clamp` y con los alérgenos participando del cálculo.
