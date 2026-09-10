# Tests de layout

Pruebas automatizadas del motor `layout-engine.js` sobre las pantallas de la preview.

## Ejecutar

```bash
node tests/run-layout-tests.mjs
```

Requiere **Google Chrome**. Si no está en la ruta por defecto:

```bash
CHROME="/ruta/a/Google Chrome" node tests/run-layout-tests.mjs
```

Salida: número de casos y fallos, con detalle por página/resolución/perfil/cantidad.
Código de salida `0` si todo pasa, `1` si hay cualquier fallo.

## Cobertura

- **Páginas:** `comedor.html`, `comidas_especiales.html`
- **Resoluciones:** 1920×1080, 2560×1440, 3840×2160
- **Perfiles de contenido:** nombres cortos, muy largos, traducción muy larga, muchos alérgenos,
  muchas trazas, combinación extrema
- **Cantidades:** 1, 2, 4, 6, 8, 10, 12, 16, 20
- **Total:** 324 casos

## Comprobaciones por caso

En los contenedores críticos (`#main-col`, `.dish-row` y sus hijos):

- `scrollWidth <= clientWidth`
- `scrollHeight <= clientHeight`
- Sin `child-outside-row` (ningún elemento fuera de su contenedor)
- Sin `text-clipped` (nada recortado)
- Sin `blocks-overlap` ni `row-overlap` (nada solapado)
- Sin `container-overflow-x/y`
- Sin scroll en el documento

## Notas

- El runner arranca su propio servidor estático y su propio Chrome headless; no necesita
  dependencias ni build.
- Usa datos mock inyectados en memoria. **No contacta con Firebase.**
