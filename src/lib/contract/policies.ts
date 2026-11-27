import { createEnumAdapter } from "./adapter";

/** Plantillas de política con los nombres de la interfaz (V-24). */
export type PolicyTemplate = "public" | "authenticated" | "owner" | "ownerOrAdmin" | "admin";

/** `Policy` del contrato 0.6.0 (glosario, «Plantilla de política»). */
export type ApiPolicy = "public" | "authenticated" | "owner_only" | "owner_or_admin" | "admin_only";

const POLICIES: Record<PolicyTemplate, ApiPolicy> = {
  public: "public",
  authenticated: "authenticated",
  owner: "owner_only",
  ownerOrAdmin: "owner_or_admin",
  admin: "admin_only",
};

export const policyAdapter = createEnumAdapter("policy", POLICIES, "authenticated");

/** RF-41: `owner_only` y `owner_or_admin` exigen `owner_field` (`policy.owner_field_required`). */
export function requiresOwnerField(policy: ApiPolicy): boolean {
  return policy === "owner_only" || policy === "owner_or_admin";
}
