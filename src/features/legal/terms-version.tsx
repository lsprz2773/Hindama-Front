"use client";

import { useTranslations } from "next-intl";
import { useMe } from "@/features/account/api";

/**
 * Versión del texto de los términos que publica este frontend. La API solo maneja la versión
 * vigente (`terms.current_version` de `GET /me`) y el texto lo publica el frontend (guía del
 * frontend §5.1); un visitante sin sesión no puede leer `/me`, así que ve esta.
 * TODO(api): si cambia el texto, acordar la versión nueva con el backend (guía §5.1).
 */
export const PUBLISHED_TERMS_VERSION = "2026-10-30";

/** Etiqueta de versión de V-07: con sesión, la versión vigente que informa la API. */
export function TermsVersionBadge() {
  const t = useTranslations("Terms");
  const me = useMe();
  const version = me.data?.terms.current_version ?? PUBLISHED_TERMS_VERSION;
  return <>{t("badge", { version })}</>;
}
