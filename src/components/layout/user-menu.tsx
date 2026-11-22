"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { DropdownMenu } from "radix-ui";
import { useState } from "react";
import { LanguageSelector } from "@/components/ui/language-selector";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { useMe } from "@/features/account/api";
import { useRouter } from "@/i18n/navigation";
import { setCsrfToken, useHttpClient } from "@/lib/http/browser";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

/**
 * Menú de usuario de la cabecera (C-01): el nombre sale de `GET /me`; cerrar sesión llama al
 * BFF, que revoca el refresh token en Cognito y borra la cookie (RF-04).
 */
export function UserMenu() {
  const t = useTranslations("UserMenu");
  const router = useRouter();
  const http = useHttpClient();
  const queryClient = useQueryClient();
  const toast = useToast();
  const me = useMe();
  const [signingOut, setSigningOut] = useState(false);
  const name = me.data?.name ?? "";

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await http.post("/auth/sign-out");
    } catch {
      toast.show({ type: "error", title: t("signOutError") });
      setSigningOut(false);
      return;
    }
    setCsrfToken(undefined);
    queryClient.clear();
    router.replace("/");
  }

  if (!me.data) {
    return (
      <span
        aria-busy="true"
        aria-label={t("loading")}
        className="border-line bg-panel flex min-h-12 items-center gap-2.5 rounded-full border py-1 pr-3.5 pl-1"
      >
        <Skeleton className="size-10 rounded-full" />
        <Skeleton className="h-4 w-24" />
      </span>
    );
  }

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
            disabled={signingOut}
            onSelect={() => void signOut()}
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
