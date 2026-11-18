import { notFound } from "next/navigation";

// Cualquier ruta no definida cae aquí para mostrar la página 404 dentro del idioma activo.
export default function CatchAllPage() {
  notFound();
}
