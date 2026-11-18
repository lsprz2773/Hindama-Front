"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { checkPassword, PASSWORD_RULES } from "@/lib/password";
import { Icon } from "./icon";

/** Lista de requisitos que se marcan en vivo mientras se escribe la contraseña. */
export function PasswordRules({ value }: { value: string }) {
  const t = useTranslations("PasswordRules");
  const result = checkPassword(value);

  return (
    <ul
      aria-label={t("label")}
      className="mt-1 grid list-none grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-x-3.5 gap-y-1.5 p-0"
    >
      {PASSWORD_RULES.map(({ id }) => {
        const ok = result[id];
        return (
          <li
            key={id}
            className={cn(
              "flex items-center gap-2 text-[13.5px]",
              ok ? "text-success" : "text-muted",
            )}
          >
            <Icon name={ok ? "check" : "circle"} size={16} strokeWidth={2.4} />
            <span>
              {t(id)}
              <span className="sr-only">{ok ? t("met") : t("pending")}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
