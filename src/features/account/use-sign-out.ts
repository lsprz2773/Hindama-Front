"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useToast } from "@/components/ui/toast";
import { useRouter } from "@/i18n/navigation";
import { setCsrfToken, useHttpClient } from "@/lib/http/browser";

/**
 * Cerrar sesión (RF-04): el BFF revoca el refresh token en Cognito y borra la cookie; después se
 * olvidan los datos en memoria y se lleva a iniciar sesión. Lo comparten el menú de usuario y la
 * barra lateral. Si Cognito no confirma la revocación, la sesión solo se cerró en este navegador y
 * se avisa.
 */
export function useSignOut() {
  const t = useTranslations("UserMenu");
  const tn = useTranslations("HomeNotice");
  const router = useRouter();
  const http = useHttpClient();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    let revoked = true;
    try {
      const { data } = await http.post<{ revoked?: unknown }>("/auth/sign-out");
      revoked = data?.revoked !== false;
    } catch {
      toast.show({ type: "error", title: t("signOutError") });
      setSigningOut(false);
      return;
    }
    setCsrfToken(undefined);
    queryClient.clear();
    if (!revoked) {
      toast.show({
        type: "warning",
        title: tn("local_sign_out.title"),
        text: tn("local_sign_out.text"),
        duration: 0,
      });
    }
    router.replace("/sign-in");
  }

  return { signOut, signingOut };
}
