"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { useSessionState } from "@/lib/http/use-session-state";

/** Con la sesión abierta, `/sign-in` y `/sign-up` llevan a la pantalla inicial de su rol (F-05). */
export function RedirectIfSignedIn() {
  const session = useSessionState();
  const router = useRouter();
  useEffect(() => {
    if (session.status === "in") router.replace(session.role === "admin" ? "/admin" : "/projects");
  }, [session, router]);
  return null;
}
