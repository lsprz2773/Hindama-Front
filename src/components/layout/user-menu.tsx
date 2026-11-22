"use client";

import { useTranslations } from "next-intl";
import { DropdownMenu } from "radix-ui";
import { LanguageSelector } from "@/components/ui/language-selector";
import { Icon } from "@/components/ui/icon";
import { useRouter } from "@/i18n/navigation";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

/** Menú de usuario de la cabecera: perfil, idioma y cerrar sesión. */
export function UserMenu({ name }: { name: string }) {
  const t = useTranslations("UserMenu");
  const router = useRouter();

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className="border-line bg-panel text-fg flex min-h-12 cursor-pointer items-center gap-2.5 rounded-full border py-1 pr-3.5 pl-1 text-[15px]">
        <span
          aria-hidden="true"
          className="bg-accent text-on-accent inline-flex size-10 items-center justify-center rounded-full font-bold"
        >
          {initials(name)}
        </span>
        {name}
        <Icon name="chevronDown" size={16} />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="border-line-strong bg-menu text-fg data-[state=open]:animate-menu-in data-[state=closed]:animate-menu-out z-50 min-w-[240px] origin-top-right rounded-[20px] border p-1.5 shadow-[0_18px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl"
        >
          <DropdownMenu.Item
            onSelect={() => router.push("/profile")}
            className="data-[highlighted]:bg-selected flex min-h-11 cursor-pointer items-center gap-3 rounded-[14px] px-3 text-[14.5px] outline-none"
          >
            <Icon name="user" size={18} />
            {t("profile")}
          </DropdownMenu.Item>
          <div className="flex items-center justify-between gap-3 px-3 py-2">
            <span className="text-muted text-[13px]">{t("language")}</span>
            <LanguageSelector variant="segmented" />
          </div>
          <DropdownMenu.Separator className="bg-line my-1 h-px" />
          <DropdownMenu.Item
            onSelect={() => router.push("/sign-in")}
            className="data-[highlighted]:bg-selected flex min-h-11 cursor-pointer items-center gap-3 rounded-[14px] px-3 text-[14.5px] outline-none"
          >
            <Icon name="logout" size={18} />
            {t("signOut")}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
