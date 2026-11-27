# Animaciones, transiciones y esqueletos de carga

Inventario de los casos de uso con movimiento en el frontend de Hindama, el sistema que los
anima y la receta para conectar los esqueletos de carga cuando exista la API.

## 1. Sistema de movimiento

Todo el movimiento sale de `src/app/globals.css` (bloque «Sistema de movimiento»). No hay
librerías: son animaciones CSS expuestas como utilidades de Tailwind.

| Utilidad | Qué hace | Duración |
| --- | --- | --- |
| `animate-page-in` | Entrada de una vista: fundido y ascenso de 8 px | 320 ms |
| `animate-fade-in` | Fundido (banners, estados de página, contenido que llega) | 220 ms |
| `animate-rise` / `.stagger` | Los hijos de una lista o rejilla suben uno tras otro (45 ms de desfase, tope 360 ms) | 420 ms |
| `animate-overlay-in/out` | Telón de fondo de un modal | 180 / 160 ms |
| `animate-modal-in/out` | Cuadro del modal: escala 0.96 → 1 con ascenso | 240 / 160 ms |
| `animate-menu-in/out` | Menús desplegables, desde su esquina | 160 / 120 ms |
| `animate-toast-in/out` | Toast: entra por la derecha y sale con la misma ruta | 320 / 200 ms |
| `animate-grow-x` / `animate-grow-y` | Barras que crecen desde su base (severidad, módulos, historial) | 600 / 700 ms |
| `animate-draw` | La línea de la gráfica se dibuja de izquierda a derecha | 900 ms |
| `.skeleton` | Barrido de luz sobre la pista de un esqueleto | 1,6 s en bucle |

Reglas:

- **Reducir movimiento.** Con `prefers-reduced-motion: reduce` toda animación y transición pasa
  a 0,01 ms (el estado final se conserva) y el barrido de los esqueletos se apaga.
- Solo se animan `opacity` y `transform` (y `stroke-dashoffset` en la línea): nada que fuerce
  recalcular el diseño.
- Los controles (botones, enlaces, pestañas, campos) usan transiciones de color de 150–200 ms.

## 2. Casos de uso con movimiento

### Cambios de vista

| Caso | Movimiento | Dónde |
| --- | --- | --- |
| Navegar entre vistas con sesión (todas las V-xx del analista y del administrador) | El marco (barra lateral y cabecera) se queda fijo; el contenido entra con `animate-page-in` | `components/layout/page-transition.tsx`, usado por `AppShell` y `PublicShell` |
| Entrar a pantallas de acceso (V-02 a V-06, V-35) | El marco completo entra con `animate-page-in` | `components/layout/auth-shell.tsx` |
| Pasos de un mismo formulario (recuperar contraseña, asistente de proyecto) | Fundido al cambiar de paso | Estados de cada formulario |
| Cambiar de pestaña (Resumen · Matriz · Hallazgos) o de periodo | El selector cambia de color con transición; el contenido se renueva con fundido | `run-tabs.tsx`, `stats-view.tsx` |

### Modales (C-20 y derivados)

Todos comparten `components/ui/modal.tsx`: el telón entra con fundido y el cuadro con escala y
ascenso; al cerrar hacen el recorrido inverso antes de salir del DOM.

| Modal | Se abre con | Se cierra con |
| --- | --- | --- |
| Confirmación (C-06), p. ej. cancelar la ejecución, salir con cambios sin guardar | Acciones destructivas o de riesgo | Confirmar, cancelar, Esc |
| Eliminar con nombre (C-07) y eliminar cuenta (C-14) | Menú de la tarjeta, ajustes del proyecto, perfil | Éxito de la acción, cancelar, Esc |
| Aceptar riesgo / falso positivo (C-09) | «Aceptar el riesgo» en el detalle del hallazgo | Guardar, cancelar, Esc |
| Cambiar contraseña (C-17), activar y desactivar 2FA | Perfil | Éxito (estado «listo»), cancelar |
| Host cambiado, prueba fallida, eliminar identidad o recurso | Ajustes del proyecto, formulario de identidad, recursos | Confirmar, cancelar |
| Bloqueante (términos nuevos) | Automático | Solo con su botón (no cierra con Esc) |

Estados internos con transición: ocupado (botón con spinner, no se puede cerrar), error dentro
del modal (aparece con fundido) y éxito (reemplaza el contenido por la confirmación).

### Toasts (C-19)

Entran por la derecha, se pausan al pasar el cursor o enfocar y salen con animación (`closing`
en `toast.tsx`; se quitan del DOM a los 200 ms). Máximo tres apilados.

Disparadores: copiar (código, curl, identificador), guardar y eliminar (proyecto, identidad,
recurso, política, ajustes), enviar, reenviar y verificar códigos, iniciar, cancelar y terminar
ejecuciones, exportar a Excel, preparar la impresión, aceptar o revertir un riesgo, recuperar la
conexión y los avisos de entrada (cuenta eliminada, sesión cerrada).

### Menús desplegables

Menú de usuario, selector de idioma y menú de la tarjeta de proyecto: `animate-menu-in/out`,
con origen en su esquina.

### Banners, avisos y estados de página

Banners persistentes y avisos de la API (C-11, C-16), recursos pendientes (C-15), sin conexión
y todos los estados de página (vacío, sin resultados, error, 403, 429, 503): entran con
`animate-fade-in`. «Sin conexión» aparece y desaparece solo al cambiar la red.

### Listas, rejillas y gráficas

- `.stagger` en todas las listas y rejillas de tarjetas, indicadores y filas (proyectos,
  módulos, identidades, hallazgos, historial, KPI, bitácora…).
- Medidores de severidad: cada barra crece con 60 ms de desfase.
- Historial: las barras crecen desde la base; Estadísticas: la línea se dibuja y los puntos
  aparecen después; las barras de fallas crecen desde la izquierda.
- Ejecución en curso: la barra de avance y los módulos avanzan con `transition-[width]` de 700 ms.

### Controles

Botones (hover con brillo, pulsación con ligero hundimiento), enlaces de la barra lateral,
pestañas, selectores segmentados, interruptor de «Solo discrepancias» y campos de formulario
(borde al pasar el cursor) tienen transición de color.

## 3. Esqueletos de carga

### Piezas

| Pieza | Archivo | Para qué |
| --- | --- | --- |
| `Skeleton`, `SkeletonText`, `SkeletonCard`, `SkeletonStat`, `SkeletonRows`, `SkeletonChart` | `components/ui/skeleton.tsx` | Bloques con el barrido de luz |
| `SkeletonRegion` | idem | Región accesible: `role="status"`, `aria-busy` y texto «Cargando…» |
| `ListPageSkeleton`, `DashboardSkeleton`, `TablePageSkeleton`, `DetailSkeleton`, `FormSkeleton`, `StatsSkeleton` | `components/skeletons/page-skeletons.tsx` | Esqueleto de cada tipo de vista, con las medidas de las reales |
| `AppShellSkeleton` | `components/skeletons/app-shell-skeleton.tsx` | Marco (barra lateral y cabecera) para cuando se agreguen `loading.tsx` de ruta |
| `useLoadingPhase` | `lib/use-loading-phase.ts` | Lógica de tiempos |
| `Loadable` | `components/ui/loadable.tsx` | Une estado de consulta, esqueleto, error y contenido |

### Lógica de tiempos (`useLoadingPhase`)

1. **Espera 150 ms** antes de pintar el esqueleto: una carga rápida no parpadea.
2. Una vez visible, el esqueleto **se queda al menos 400 ms**: tampoco hay destellos al revés.
3. Al llegar el contenido hace un fundido (`animate-fade-in`).
4. Cada recarga (filtros, periodo, reintento) abre un ciclo nuevo con la misma regla.
5. Un error se pinta de inmediato (o al terminar el mínimo, si ya había esqueleto) con
   «Reintentar».

Los dos tiempos se pueden cambiar por vista (`delay`, `minDuration`). Está cubierto con pruebas
unitarias (`use-loading-phase.test.ts`) y e2e (`e2e/motion.spec.ts`).

### Receta para conectar la API

```tsx
// 1. La consulta entrega su estado: "loading" | "ready" | "error".
const { data, status, refetch } = useQuery(...); // TODO(api)

// 2. La vista se envuelve en Loadable con el esqueleto de su tipo.
<Loadable
  status={status}
  skeleton={<TablePageSkeleton label={t("loading")} />}
  error={{ subject: t("errorSubject"), reference: error?.reference, onRetry: refetch }}
>
  <FindingsTable data={data} />
</Loadable>
```

- **Rutas (`loading.tsx`).** Todavía no hay: con `cacheComponents`, agregar un `loading.tsx` a
  `projects/` o `projects/[id]/` hace que `next build` falle al prerrenderizar («uncached or
  runtime data … outside of `<Suspense>`», lanzado desde `LocaleLayout`). Al conectar la API,
  si se quiere un esqueleto de ruta, primero hay que envolver en `<Suspense>` lo que lee datos
  del layout o marcar el segmento con `export const instant = false`, y comprobar `npm run build`.
  Mientras tanto, el esqueleto vive dentro de la vista con `Loadable`, que no tiene ese problema.
- `features/admin/use-simulated-load.ts` es la simulación actual (estadísticas y bitácora):
  se reemplaza por la consulta real y las vistas no cambian. Para ver el estado de error basta
  `sessionStorage.setItem("hindama.simulate.error", "1")`.
- La galería (`/design-system`, solo en desarrollo) tiene la sección «Animaciones y esqueletos
  de carga» con todos los esqueletos y una demostración de `Loadable` con sus tres estados.

## 4. Pruebas

- Unitarias: `src/lib/use-loading-phase.test.ts`.
- e2e: `e2e/motion.spec.ts` comprueba la transición de página, el escalonado de listas, modal,
  toast, menú, barras y gráfica, el modo de movimiento reducido y los esqueletos.
