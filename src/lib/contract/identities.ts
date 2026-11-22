import type { AuthForm, Identity, IdentityRole } from "@/features/config/data";
import { createEnumAdapter } from "./adapter";

/** `AuthType` del contrato 0.6.0; `none` solo lo tiene la identidad anónima. */
export type ApiAuthType = "none" | "login" | "bearer" | "cookie" | "header";
/** `IdentityRole` del contrato. */
export type ApiIdentityRole = "admin" | "user" | "other";
/** `IdentityStatus` del contrato. */
export type ApiIdentityStatus = "active" | "expired_credential";

const AUTH_TYPES: Record<AuthForm | "none", ApiAuthType> = {
  none: "none",
  login: "login",
  bearer: "bearer",
  cookie: "cookie",
  header: "header",
};

export const authTypeAdapter = createEnumAdapter("auth_type", AUTH_TYPES, "none");

const IDENTITY_ROLES: Record<IdentityRole, ApiIdentityRole> = {
  admin: "admin",
  user: "user",
  other: "other",
};

export const identityRoleAdapter = createEnumAdapter("identity_role", IDENTITY_ROLES, "other");

type UiIdentityStatus = Exclude<Identity["status"], "untested">;

const IDENTITY_STATUSES: Record<UiIdentityStatus, ApiIdentityStatus> = {
  active: "active",
  expiredCredential: "expired_credential",
};

export const identityStatusAdapter = createEnumAdapter(
  "identity_status",
  IDENTITY_STATUSES,
  "active",
);

/**
 * El contrato no tiene un estado «sin probar»: se deriva de `last_tested_at: null`
 * (RF-32). Una credencial vencida manda sobre «sin probar».
 */
export function identityStatusFromApi(
  status: string,
  lastTestedAt: string | null,
): Identity["status"] {
  const ui = identityStatusAdapter.fromApi(status);
  return ui === "active" && lastTestedAt === null ? "untested" : ui;
}
