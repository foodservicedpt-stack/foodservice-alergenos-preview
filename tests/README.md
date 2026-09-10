# Tests de layout

Pruebas automatizadas del motor `layout-engine.js` sobre las pantallas de la preview.

## Ejecutar

```bash
node tests/run-layout-tests.mjs
```

Requiere **Google Chrome** (configurable con `CHROME=/ruta/a/Google Chrome`).
Salida: casos, fallos y detalle. Código de salida 0 si todo pasa, 1 si hay fallos.

## Cobertura

- **Páginas:** `comedor.html`, `comidas_especiales.html`
- **Resoluciones:** 1280×720, 1920×1080, 2560×1440, 3840×2160
- **Escenarios:** A platos normales · B nombres largos ES · C largos + traducciones largas ·
  D muchos alérgenos · E muchas trazas · F largos + traducciones + alérgenos + trazas ·
  G mezcla realista · H extremo · MENU12 menú extremo de 12 platos
- **Cantidades:** 1, 2, 4, 6, 8, 10, 12, 16, 20
- **Matriz de layout:** 584 casos
- **Resize:** secuencia 1280 → 3840 → 2560 → 1920 → 1280 por pantalla, comprobando validez,
  páginas correctas y que solo se reconstruye un motor por resize (sin bucles)

## Comprobaciones

En `#main-col`, `.dish-row` y sus hijos: `scrollWidth <= clientWidth`,
`scrollHeight <= clientHeight`, sin clipping, sin solape, sin elementos fuera, sin scroll de
documento y `unfit = false`. En resize, además: páginas no vacías y número de reconstrucciones
del motor acotado.

## Notas

El runner arranca su propio servidor estático y su propio Chrome headless; sin dependencias ni
build. Usa datos mock en memoria: **no contacta con Firebase**.
