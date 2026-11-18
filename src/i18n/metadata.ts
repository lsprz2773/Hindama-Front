import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { resolveLocale } from "./params";

export type PageTitleKey =
  | "adminStats"
  | "auditLog"
  | "dashboard"
  | "contract"
  | "versions"
  | "findings"
  | "finding"
  | "history"
  | "identities"
  | "identityNew"
  | "identityEdit"
  | "policy"
  | "resources"
  | "runCurrent"
  | "runNew"
  | "runResults"
  | "matrix"
  | "report"
  | "settings"
  | "verification";

/** Título de pestaña de una página, en el idioma activo. */
export async function pageTitle(
  params: Promise<{ locale: string }>,
  key: PageTitleKey,
): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "PageTitles" });
  return { title: t(key) };
}
