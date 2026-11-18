import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { routing, type Locale } from "./routing";

/**
 * Valida el segmento `[locale]` de una página, lo fija para el renderizado
 * estático y devuelve el idioma ya tipado. Idioma desconocido → 404.
 */
export async function resolveLocale(params: Promise<{ locale: string }>): Promise<Locale> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return locale;
}
