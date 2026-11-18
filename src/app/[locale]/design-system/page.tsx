import { notFound } from "next/navigation";
import { Gallery } from "@/features/design-system/gallery";
import { resolveLocale } from "@/i18n/params";

/** Galería de componentes para revisión visual y pruebas e2e. No existe en producción. */
export default async function DesignSystemPage({ params }: PageProps<"/[locale]/design-system">) {
  await resolveLocale(params);
  if (process.env.NODE_ENV === "production") notFound();
  return <Gallery />;
}
