import { PageTransition } from "./page-transition";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { AccountNav } from "./account-nav";
import { LanguageSelector } from "@/components/ui/language-selector";
import { Logo } from "@/components/ui/logo";
import { Link } from "@/i18n/navigation";

/** Marco del área pública (V-01, V-07, V-08, V-12): encabezado, contenido y pie legal. */
export function PublicShell({ children, notice }: { children: ReactNode; notice?: ReactNode }) {
  const t = useTranslations("Common");

  return (
    <div className="min-h-screen p-4 sm:p-6">
      <div className="border-line bg-frame mx-auto flex max-w-[1360px] flex-col gap-5 rounded-[34px] border p-4 backdrop-blur-2xl">
        <header className="flex flex-wrap items-center justify-between gap-4 px-3 py-2">
          <Logo label={t("homeLink")} />
          <div className="flex flex-wrap items-center gap-2.5">
            <LanguageSelector />
            <AccountNav />
          </div>
        </header>
        {notice}
        <main id="main" className="flex flex-col gap-5">
          <PageTransition>{children}</PageTransition>
        </main>
        <footer className="text-muted flex flex-wrap justify-between gap-3 px-4 pt-[18px] pb-2 text-sm">
          <span>© 2026 Hindama</span>
          <nav aria-label={t("legalNav")} className="flex gap-[18px]">
            <Link href="/terms" className="text-link">
              {t("terms")}
            </Link>
            <Link href="/privacy" className="text-link">
              {t("privacy")}
            </Link>
          </nav>
        </footer>
      </div>
    </div>
  );
}

/** Tarjeta de vidrio reutilizable para el contenido de las páginas públicas. */
export function GlassPanel({
  children,
  className = "",
  as: Tag = "section",
  ...props
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "article" | "div" | "nav" | "li";
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <Tag
      className={`border-line bg-panel rounded-[28px] border p-6 backdrop-blur-lg ${className}`}
      {...props}
    >
      {children}
    </Tag>
  );
}
