"use client";

import { useLocale, useTranslations } from "next-intl";
import { DropdownMenu } from "radix-ui";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { cn } from "@/lib/cn";
import { Icon } from "./icon";

interface LanguageSelectorProps {
  /** `menu`: desplegable (encabezados y pies). `segmented`: ES | EN (preferencias del perfil). */
  variant?: "menu" | "segmented";
  /** Abre la lista hacia arriba (pie de los formularios de acceso). */
  placement?: "top" | "bottom";
  className?: string;
}

/** C-18. Cambia el idioma conservando la página; el idioma vive en la ruta y en la cookie. */
export function LanguageSelector({
  variant = "menu",
  placement = "bottom",
  className,
}: LanguageSelectorProps) {
  const t = useTranslations("LanguageSelector");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();

  function choose(next: string) {
    if (next === locale) return;
    router.replace(pathname, { locale: next as Locale });
  }

  if (variant === "segmented") {
    return (
      <div
        role="group"
        aria-label={t("groupLabel")}
        className={cn(
          "border-line bg-panel-2 inline-flex gap-1 rounded-full border p-1",
          className,
        )}
      >
        {routing.locales.map((code) => {
          const active = code === locale;
          return (
            <button
              key={code}
              type="button"
              aria-pressed={active}
              aria-label={t(code)}
              onClick={() => choose(code)}
              className={cn(
                "min-h-10 min-w-[52px] cursor-pointer rounded-full px-3.5 text-[13.5px] font-bold tracking-[0.04em]",
                active ? "bg-accent text-on-accent" : "text-fg",
              )}
            >
              {code.toUpperCase()}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label={t("current", { language: t(locale) })}
        className={cn(
          "border-line bg-panel-2 text-fg inline-flex min-h-[46px] cursor-pointer items-center gap-2 rounded-2xl border px-3.5 text-[14.5px] font-semibold backdrop-blur-lg",
          className,
        )}
      >
        <Icon name="globe" size={18} />
        {t(locale)}
        <Icon name="chevronDown" size={16} />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side={placement}
          align="end"
          sideOffset={8}
          className="border-line-strong bg-menu text-fg z-50 min-w-[200px] rounded-[20px] border p-1.5 shadow-[0_18px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl"
        >
          <DropdownMenu.RadioGroup value={locale} onValueChange={choose} aria-label={t("label")}>
            {routing.locales.map((code) => (
              <DropdownMenu.RadioItem
                key={code}
                value={code}
                className="data-[highlighted]:bg-selected data-[state=checked]:bg-selected flex min-h-[46px] cursor-pointer items-center justify-between gap-3 rounded-[14px] px-3 text-[14.5px] outline-none data-[state=checked]:font-bold"
              >
                <span className="flex flex-col">
                  <span>{t(code)}</span>
                  <span className="text-muted text-xs font-medium">{t(`${code}Note`)}</span>
                </span>
                <DropdownMenu.ItemIndicator>
                  <Icon name="check" size={18} strokeWidth={2.4} className="text-accent" />
                </DropdownMenu.ItemIndicator>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
