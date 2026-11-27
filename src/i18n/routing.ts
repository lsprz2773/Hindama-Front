import { defineRouting } from "next-intl/routing";

/**
 * Español es el idioma principal y no lleva prefijo (`/projects`);
 * el inglés va con prefijo (`/en/projects`). next-intl recuerda la elección en la cookie
 * `NEXT_LOCALE` (C-18, selector de idioma).
 */
export const routing = defineRouting({
  locales: ["es", "en"],
  defaultLocale: "es",
  localePrefix: "as-needed",
});

export type Locale = (typeof routing.locales)[number];
