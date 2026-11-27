import { notFound } from "next/navigation";

/**
 * Esta página existe solo para lanzar el 404, así que su «render» siempre falla a propósito: se
 * excluye de la validación de navegación instantánea (de lo contrario Next avisa «Could not
 * validate `instant` because an error prevented the target segment from rendering»).
 */
export const instant = false;

// Cualquier ruta no definida cae aquí para mostrar la página 404 dentro del idioma activo.
export default function CatchAllPage() {
  notFound();
}
