"use client";

import { useTranslations } from "next-intl";
import { ButtonLink } from "@/components/ui/button";
import { useSessionState } from "@/lib/http/use-session-state";

/**
 * Acciones de cuenta del encabezado público. Con la sesión abierta no se ofrece iniciar sesión ni
 * crear una cuenta (F-03): lleva a la pantalla inicial de su rol. Mientras se consulta, los
 * botones ocupan su lugar sin verse, para que el encabezado no salte.
 */
export function AccountNav() {
  const t = useTranslations("Common");
  const session = useSessionState();
  if (session.status === "in") {
    const admin = session.role === "admin";
    return (
      <nav aria-label={t("accountNav")} className="flex flex-wrap gap-2.5">
        <ButtonLink href={admin ? "/admin" : "/projects"} size="sm">
          {admin ? t("goAdmin") : t("goProjects")}
        </ButtonLink>
      </nav>
    );
  }
  return (
    <nav
      aria-label={t("accountNav")}
      className={`flex flex-wrap gap-2.5 ${session.status === "unknown" ? "invisible" : ""}`}
    >
      <ButtonLink href="/sign-in" variant="secondary" size="sm">
        {t("signIn")}
      </ButtonLink>
      <ButtonLink href="/sign-up" size="sm">
        {t("signUp")}
      </ButtonLink>
    </nav>
  );
}
