# FASE 4 — Estado "Comedor cerrado" limpio

**Fecha:** 2026-09-10
**Ámbito:** `comedor.html` (preview)

---

## Objetivo

La pantalla de "Comedor cerrado" debía mostrar **únicamente**:

```
[LOGO]
FOOD SERVICE DPT
COMEDOR CERRADO
DINING ROOM CLOSED
[HORA ACTUAL GRANDE]
```

Sin "El comedor está cerrado", sin "The dining room is closed", sin "HORA ACTUAL · CURRENT TIME"
ni ningún otro texto. Sin carousel ni mensajes rotativos. Con el reloj actualizándose.

---

## Cambios

1. **Eliminados del DOM** (overlay `#cierre-overlay`):
   - `<div class="cierre-message-es">El comedor está cerrado</div>`
   - `<div class="cierre-message-en">The dining room is closed</div>`
   - `<div class="cierre-clock-label">HORA ACTUAL · CURRENT TIME</div>`
2. **Eliminada la lógica** en `refreshCierre()` que rellenaba los mensajes configurables
   (`cierreConfig.mensajeEs/mensajeEn`). Esos campos del panel de gestión ya no se usan.
3. **Eliminado el CSS muerto** de `.cierre-message-es`, `.cierre-message-en` y `.cierre-clock-label`.

El reloj sigue actualizándose cada segundo por el mismo `setInterval` de `updateClock()`
(`refreshCierre()` + `updateCierreClock()`).

---

## Verificación

Comprobado en navegador en 1280×720, 1920×1080 y 3840×2160 con el cierre activo. Los únicos nodos
de texto visibles en el overlay son:

| Elemento | Texto |
|---|---|
| `.cierre-kicker` | FOOD SERVICE DPT |
| `.cierre-title` | COMEDOR CERRADO |
| `.cierre-sub-en` | DINING ROOM CLOSED |
| `.cierre-clock` | HH:MM (hora real) |

- `grep` de `cierre-message`, `cierre-clock-label`, "El comedor está cerrado", "The dining room is closed"
  y "HORA ACTUAL" → **sin restos**.
- Centrado y coherente con el diseño actual (mismo degradado, misma tipografía, mismas líneas).
- Sin carousel ni mensajes rotativos.

> Nota: el `scrollHeight` del overlay supera el viewport por el pseudo-elemento decorativo
> `.cierre-card::before` (el halo radial que se extiende por debajo), recortado por `overflow:hidden`.
> No es contenido recortado; el contenido real queda centrado y visible.

---

## Pendiente

- Los campos `mensajeEs`/`mensajeEn` del cierre siguen existiendo en `gestion.html` (fuera de la
  preview) pero ya no tienen efecto en la pantalla. Conviene limpiarlos en la integración.
- El `line-clamp` del carousel de turno (despedida) sigue pendiente de revisión; no pertenece al
  estado "Comedor cerrado".
