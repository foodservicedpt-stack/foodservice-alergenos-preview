# foodservice-alergenos-preview

Entorno **experimental y aislado** del sistema de alérgenos Food Service DPT, creado para
desarrollar y validar la **nueva implementación del sistema de layout del comedor** antes de
integrarla en producción.

> ⚠️ Este repositorio **no es producción**. No contiene el panel de gestión, no usa las
> credenciales de Firebase de producción y no escribe en ninguna base de datos remota.

---

## Aislamiento respecto a producción

| Aspecto | Repositorio original | Esta preview |
|---|---|---|
| Repositorio | `foodservice-alergenos` | `foodservice-alergenos-preview` |
| Firebase | Proyecto real `foodservice-alergenos-5fe9b` | **Ninguno** — datos mock en memoria |
| SDK de Firebase | Se carga desde gstatic | **No se carga** (etiquetas eliminadas) |
| Panel de gestión | Incluido y escribe en RTDB | **No incluido** |
| Datos | Producción | `mock-data.js` (solo navegador) |
| Despliegue | GitHub Pages de producción | GitHub Pages de este repositorio |

Las tres pantallas copiadas (`comedor.html`, `comidas_especiales.html`, `desayuno.html`) se han
mantenido **idénticas** salvo el bloque de carga de scripts, sustituido por:

```html
<script src="./mock-data.js"></script>
<script src="./firebase-config.js"></script>
```

`firebase-config.js` implementa una base de datos en memoria que respeta la misma API que usaba
la app (`ref().on()/.off()/.once()/.set()/.update()/.push()`). Cualquier escritura —por ejemplo
desde la ficha de desayuno— se queda en `window.MOCK_DB` y nunca sale del navegador.

---

## Datos de prueba

- `mock-data.js` define `window.MOCK_DB` con menú del comedor (8 platos, nombres cortos y muy
  largos, alérgenos, trazas y `sinGluten`), ficha de desayuno, turnos, recordatorios y ajustes de TV.
- Las rutas `menu/comedor` y `menu/desayuno` reciben **siempre la fecha de hoy** al leerse, para
  que la preview no caiga en el estado "menú no publicado".
- Para forzar el estado **"Comedor cerrado"** (Fase 4), edita `mock-data.js`:
  `'cierreComedor': { activo: true }`.

---

## Ejecución local

Cualquier servidor estático sirve. Por ejemplo:

```bash
python3 -m http.server 8777
# abrir http://127.0.0.1:8777/
```

No requiere build ni dependencias.

---

## Estado de las fases

- [x] **Fase 1** — Auditoría de arquitectura → `ARCHITECTURE_AUDIT.md`
- [x] **Fase 2** — Copia funcional aislada de la app actual (sin cambios de layout)
- [x] **Fase 3** — Nuevo motor de layout determinista (`layout-engine.js`) en comedor y comidas especiales
- [ ] **Fase 4** — Estado "Comedor cerrado" limpio (sin textos adicionales)
- [ ] **Fase 5** — `debug-layout.html`
- [ ] **Fase 6** — Tests automatizados (1280×720, 1920×1080, 2560×1440, 3840×2160)

El repositorio de producción `foodservice-alergenos` permanece **intacto**. La integración solo
se preparará tras la aprobación explícita del responsable.
