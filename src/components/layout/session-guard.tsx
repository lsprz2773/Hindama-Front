"use client";

import { useEffect } from "react";
import { useMe } from "@/features/account/api";
import { useRouter } from "@/i18n/navigation";
import { ApiError } from "@/lib/http";

/**
 * Sin sesión válida no hay vista autenticada: si `GET /api/me` responde 401 (el BFF ya intentó
 * renovar y borró la cookie), se lleva al usuario a iniciar sesión (guía del frontend §4.2).
 */
export function SessionGuard() {
  const { error } = useMe();
  const router = useRouter();
  const expired = error instanceof ApiError && error.kind === "unauthorized";
  useEffect(() => {
    if (expired) router.replace("/sign-in");
  }, [expired, router]);
  return null;
}
