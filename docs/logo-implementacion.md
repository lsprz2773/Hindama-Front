# Logo: archivos y pasos para implementarlo

El logo de Hindama ya está aprobado (concepto «Nodo»: la «h» termina en un punto, como una petición que llega a su endpoint). Este documento indica dónde están los archivos en este repo y qué cambiar para usarlo. Todavía **no se usa en ninguna vista**: el sitio sigue con el ícono anterior (hexágono con check).

La guía completa (concepto, colores, contraste, reglas y cómo se eligió) está en `hindama-docs/04-ui/identidad/README.md`. Ese repo también guarda todas las variantes en SVG y PNG, en más tamaños.

## 1. Archivos en `public/brand/`

| Archivo | Qué es |
| --- | --- |
| `hindama-logotipo.svg` | Logotipo «hindama» en negro (maestro) |
| `hindama-logotipo-{tinta,blanco,naranja,naranja-profundo}.svg` | Logotipo en un color |
| `hindama-simbolo.svg` | Símbolo (la «h» con el punto), desde 24 px |
| `hindama-simbolo-chico.svg` | Símbolo para 16 a 48 px (trazo más grueso) |
| `hindama-simbolo-{tinta,blanco,naranja,naranja-profundo}.svg` | Símbolo en un color |
| `hindama-icono-app.svg` | Cuadro naranja con la «h» en tinta |
| `hindama-logotipo-{tinta,blanco,naranja}-1200.png` | Logotipo en PNG transparente, 1200 px de ancho |
| `hindama-simbolo-{tinta,blanco,naranja}-512.png` | Símbolo en PNG transparente, 512 px |
| `icons/` | `favicon.ico` (16, 32, 48), `favicon.svg`, `apple-touch-icon.png` (180), `icon-192.png`, `icon-512.png`, `maskable-512.png` y `site.webmanifest` |

Como están en `public/`, se sirven en `/brand/...`; por ejemplo, `/brand/hindama-logotipo-blanco.svg`.

## 2. Colores

Son los tokens que ya existen en `src/app/globals.css`:

- Naranja `#ff6b1a` (`--accent`): fondo del cuadro del símbolo y logo sobre fondo oscuro.
- Tinta `#16110d` (`--on-accent`): la «h» dentro del cuadro naranja.
- Logo sobre fondo claro: tinta, o `--text` del tema claro (`#1c1915`).
- Naranja sobre fondo claro: usar `#d24e08`, porque `#ff6b1a` sobre blanco solo llega a 2.85:1.
- **Prohibido:** símbolo blanco sobre naranja (2.85:1).

## 3. Pasos para implementarlo

### 3.1 Componente del logotipo

Crear `src/components/ui/brand-mark.tsx` con el logotipo y el símbolo como SVG en línea, con `fill="currentColor"`, para que tomen el color del tema (`text-fg`) sin cargar archivos.

- Copiar los `<path>` y `<circle>` de `public/brand/hindama-logotipo.svg` y de `hindama-simbolo-chico.svg`.
- Para el logotipo, usar `viewBox="-4 18 1196 216"`: es el recorte ajustado a las letras, con proporción de 5.54 a 1.
- Los dos SVG llevan `aria-hidden="true"`. El texto accesible lo pone el enlace que los contiene (`homeLink`, «Hindama, inicio»).

### 3.2 `src/components/ui/logo.tsx`

- **Con nombre** (`showName` en `true`): mostrar solo el logotipo, **sin el cuadro naranja**. Alturas sugeridas: 22 px en `md` y 26 px en `lg`, con un ancho aproximado de 122 y 144 px.
- **Sin nombre** (`showName` en `false`): el cuadro naranja actual (`bg-accent text-on-accent`) con el símbolo chico adentro, en lugar de `<Icon name="logo" />`.

### 3.3 `src/components/layout/sidebar.tsx` (líneas 66 a 80)

- Barra abierta: logotipo en `#f5f2ee`, sin el cuadro.
- Barra colapsada: el cuadro naranja con el símbolo chico.

Así se cumple la regla de no mostrar el símbolo junto al logotipo.

### 3.4 Íconos de la app (convenciones de archivos de Next.js)

- Reemplazar `src/app/icon.svg` con el contenido de `public/brand/icons/favicon.svg`.
- Copiar `public/brand/icons/favicon.ico` a `src/app/favicon.ico` y `apple-touch-icon.png` a `src/app/apple-icon.png`.
- Manifest: crear `src/app/manifest.ts` con los datos de `public/brand/icons/site.webmanifest`, o enlazar ese archivo desde `metadata.manifest`. Las rutas de ese archivo ya apuntan a `/brand/icons/`.
- `themeColor: "#ff6b1a"` en el `export const viewport` del layout.

### 3.5 Limpieza

- Quitar `logo` del mapa de `src/components/ui/icon.tsx` cuando ya nadie lo use.

### 3.6 Revisar

- Que el logo se vea en tema claro y oscuro, en el encabezado público, en la pantalla de acceso (`auth-shell`) y en la barra lateral abierta y colapsada.
- Que el favicon aparezca en una pestaña oscura y en una clara.
- Que el enlace del logo se siga anunciando como «Hindama, inicio» en un lector de pantalla.

## 4. Reglas de uso (resumen)

- **Espacio libre:** el diámetro del punto de la «h» por cada lado.
- **Tamaño mínimo:** logotipo, 72 px de ancho; símbolo, 24 px (por debajo, el símbolo chico, desde 16 px).
- **No hacer:**
  - el símbolo junto al logotipo;
  - escribir «Hindama» con una fuente (Lexend u otra) en lugar del logotipo;
  - estirar, girar, sombras o degradados.
