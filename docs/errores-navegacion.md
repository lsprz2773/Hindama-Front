# Errores al navegar entre vistas

Inventario de los avisos y errores que aparecían en la terminal de `next dev`, en la consola del
navegador y en el overlay de Next.js al recorrer el frontend, con su causa y su corrección.

## Cómo se obtuvo

- `npm run dev` con la salida a un archivo de log, y la app abierta en un navegador automatizado.
- Las 39 rutas (las 36 vistas, `/design-system`, su shell y un 404), en español e inglés y en
  modo claro y oscuro: carga directa por URL (156 cargas).
- Navegación con los enlaces de la app (140 saltos entre vistas), con atrás y adelante.
- Interacción: se pulsó cada botón, pestaña y menú de las vistas principales y se cerró con
  `Esc` para abrir y cerrar modales, menús y toasts.
- En cada paso se leyó la terminal de Next, la consola (`error` y `warning`) y el diálogo del overlay.

## Inventario

| ID     | Ruta (origen → destino)                                                                                             | Mensaje                                                                                                                                              | Causa probable                                                                                                                                                                                             | Severidad                                                                                                                                        | Estado    |
| ------ | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| NAV-01 | Todas las de `/projects/[id]/…` (18 rutas), con carga directa o al llegar desde otra vista, en es/en y claro/oscuro | `Next.js encountered URL data during prerendering or a navigation. params or searchParams accessed outside of <Suspense>` (overlay «Instant Server») | Cada `page.tsx` hacía `await params` en el nivel de la página: con Cache Components y Partial Prefetching eso ata el marco estático a una sola URL y la navegación deja de ser instantánea.                | Media: no rompe la vista, pero llena la terminal, la consola y abre el overlay en cada navegación, y en producción pierde el prefetch del marco. | Corregido |
| NAV-02 | `/projects/[id]/…` tras aplicar NAV-01                                                                              | `Next.js encountered runtime data during prerendering … accessed outside of <Suspense>` (overlay «Blocking Route»)                                   | `SkeletonRegion` (el esqueleto que se muestra mientras llegan los parámetros) usa `useTranslations` en un componente de servidor, que lee el idioma de la petición (`headers()`) fuera de un `<Suspense>`. | Media: aparecía solo al resolver NAV-01 (lo enmascaraba).                                                                                        | Corregido |
| NAV-03 | Cualquier ruta inexistente (p. ej. `/ruta-que-no-existe`, también `/en/…`)                                          | `Could not validate instant because an error prevented the target segment from rendering`                                                            | `src/app/[locale]/[...rest]/page.tsx` solo llama a `notFound()`; la validación de navegación instantánea intenta renderizarla y falla a propósito.                                                         | Baja: solo en desarrollo, la página 404 sale bien.                                                                                               | Corregido |

### Observados y descartados

| Mensaje                                                                                            | Dónde                                               | Motivo                                                  |
| -------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------- |
| `net::ERR_ABORTED` en `?_rsc=…`, en chunks de `_next/static` y en `__nextjs_original-stack-frames` | Al cambiar de vista antes de que acabe una precarga | El navegador cancela la petición al navegar; es normal. |
| `Failed to load resource: 404` en la consola                                                       | `/ruta-que-no-existe`                               | Es la respuesta 404 intencional de la página de error.  |

## Correcciones

- **NAV-01 y NAV-02:** nuevo `src/components/layout/route-params.tsx` (`RouteParams`). Las páginas
  pasan la promesa `params` sin esperarla; `RouteParams` la lee dentro de un `<Suspense>` con el
  marco y el esqueleto de la vista como fallback, valida el idioma (`resolveLocale`) y entrega los
  valores a la vista. `src/components/ui/skeleton.tsx` pasó a ser componente de cliente para que
  `SkeletonRegion` use el idioma del proveedor de i18n en lugar de leer la petición.
- **NAV-03:** `export const instant = false` en la página `[...rest]`, documentado en su comentario.

## Pruebas

`e2e/navigation-errors.spec.ts` reproduce los tres avisos: cada ruta (es/en) debe cargar sin
errores de consola ni overlay de Next, el 404 igual, y una navegación con enlaces más atrás y
adelante no debe abrir el overlay. Las pruebas corren contra `next dev`, que es donde Next valida.

## Pendiente

- Los avisos de Next solo existen en desarrollo; si se quisiera validar en CI con `next build`, hay
  que habilitar `experimental.exposeTestingApiInProductionBuild` y usar `@next/playwright`.
- `<title>` por proyecto y los estados de carga de V-33/V-34 siguen pendientes (ver el seguimiento
  de vistas); no son errores de navegación.
