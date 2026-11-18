import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { LanguageSelector } from "@/components/ui/language-selector";
import { Logo } from "@/components/ui/logo";

interface AuthShellProps {
  /** Título grande del lado de la presentación. */
  title: string;
  lead: string;
  /** Bloque inferior del lado de la presentación (ejemplo de hallazgo, pasos, aviso…). */
  aside?: ReactNode;
  /** Etiqueta «ADMIN» junto al logo (acceso de administradores). */
  adminBadge?: boolean;
  /** Formulario o contenido del panel derecho. */
  children: ReactNode;
}

/**
 * Marco de las pantallas de acceso (V-02 a V-06): presentación a la izquierda,
 * formulario a la derecha y selector de idioma al pie del formulario.
 */
export function AuthShell({ title, lead, aside, adminBadge, children }: AuthShellProps) {
  const t = useTranslations("Common");

  return (
    <main id="main" className="flex min-h-screen items-center justify-center p-4 sm:p-8">
      <div className="border-line bg-frame flex w-full max-w-[1240px] flex-wrap gap-4 rounded-[36px] border p-4 backdrop-blur-2xl">
        <section className="border-line flex min-w-0 flex-[999_1_480px] flex-col justify-between gap-12 rounded-[28px] border bg-[image:var(--hero)] p-6 sm:p-10">
          <div className="flex items-center gap-3">
            <Logo size="lg" label={t("homeLink")} />
            {adminBadge ? (
              <span className="border-line bg-panel-2 rounded-full border px-2.5 py-1 text-[12.5px] font-bold tracking-[0.04em]">
                ADMIN
              </span>
            ) : null}
          </div>
          <div className="flex flex-col gap-[18px]">
            <h1 className="font-display max-w-[15ch] text-[40px] leading-none font-medium tracking-[-0.04em] sm:text-6xl">
              {title}
            </h1>
            <p className="text-muted max-w-[44ch] text-[17px] leading-[1.55]">{lead}</p>
          </div>
          {aside}
        </section>

        <section className="border-line bg-panel flex min-w-0 flex-[1_1_420px] items-center rounded-[28px] border p-6 backdrop-blur-lg sm:p-10">
          <div className="flex w-full flex-col gap-5">
            {children}
            <div className="border-line mt-1 flex justify-end border-t pt-[18px]">
              <LanguageSelector placement="top" />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
