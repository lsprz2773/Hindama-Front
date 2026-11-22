import { createEnumAdapter } from "./adapter";

/** Rol de la sesión en la interfaz (barra lateral y `AppShell`). */
export type UiRole = "analyst" | "admin";
/** `Role` del contrato 0.6.0 (`GET /me`). Solo elige la pantalla inicial (RNF-08). */
export type ApiRole = "analyst" | "admin";

const ROLES: Record<UiRole, ApiRole> = { analyst: "analyst", admin: "admin" };

export const roleAdapter = createEnumAdapter("role", ROLES, "analyst");
