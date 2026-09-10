# Tests de layout — auditoría automatizada

## Ejecutar

```bash
node tests/run-layout-tests.mjs
```

Requiere Google Chrome (`CHROME=/ruta/a/Google Chrome`). Salida: tabla TEST | RESULTADO | EVIDENCIA
y código 0/1 (1 solo si hay FAIL).

## Fixture único

Los datos de prueba viven en **`fixtures.js`** (compartido con `debug-layout.html`). El caso de
referencia es **`MENU12_CANONICAL`**: 12 platos con nombres largos ES, traducciones largas, hasta 14
alérgenos y 14 trazas, platos cortos y largos y uno extremadamente largo.

## Secciones

1. **Matriz de layout** — 2 pantallas × 4 resoluciones × escenarios A–H + MENU12 × cantidades 1–20 (584 casos).
2. **MENU12_CANONICAL** en carga limpia en las 4 resoluciones.
3. **Resize determinista** — compara carga limpia vs tras 1920→2560→1280→3840→1920.
4. **Cambios de contenido** sin recargar (1→4→8→12→20→MENU12→H→1) y reproducibilidad.
5. **Caso imposible** — `unfit`, `reason=unfit-min-scale`, marcado explícito, sin bucle.
6. **Comedor cerrado** — textos exactos, prohibidos ausentes, reloj vivo, sin carousel.
7. **Overflow decorativo del cierre** — `scroll === client`.
8. **Desayuno** — no usa layout-engine (se documenta) y smoke test de sus contenedores.

## Assertions

`scrollWidth <= clientWidth`, `scrollHeight <= clientHeight`, elementos fuera del viewport,
`boundingClientRect`, clipping real, texto truncado, altura de fila, iconos fuera de su contenedor,
solape entre bloques y filas, páginas vacías, pérdida de platos y filas renderizadas === platos de
la página. En resize: páginas válidas y reconstrucciones del motor acotadas.

Sin dependencias ni build. Usa datos mock en memoria: **no contacta con Firebase**.
