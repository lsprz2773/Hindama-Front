/**
 * Datos de ejemplo de la configuración de un proyecto (fase 4).
 * TODO(api): se reemplazan por las respuestas de la API; los tipos son el contrato esperado.
 */

export type AuthForm = "login" | "bearer" | "cookie" | "header";
export type IdentityRole = "admin" | "user" | "other";

export interface Identity {
  id: string;
  name: string;
  role: IdentityRole;
  roleNote?: string;
  auth: AuthForm | "none";
  /** Últimos 4 caracteres de la credencial; nunca el valor completo. */
  last4: string | null;
  status: "active" | "expiredCredential" | "untested";
  testedAgo?: string;
  resources: number;
  fixed?: boolean;
}

export const SEED_IDENTITIES: Identity[] = [
  {
    id: "anonima",
    name: "Anónima",
    role: "other",
    roleNote: "Sin autenticar",
    auth: "none",
    last4: null,
    status: "active",
    resources: 0,
    fixed: true,
  },
  {
    id: "cliente-a",
    name: "Cliente A",
    role: "user",
    auth: "login",
    last4: "a9F2",
    status: "active",
    testedAgo: "2 h",
    resources: 9,
  },
  {
    id: "cliente-b",
    name: "Cliente B",
    role: "user",
    auth: "bearer",
    last4: "7c1e",
    status: "expiredCredential",
    resources: 9,
  },
  {
    id: "soporte",
    name: "Soporte",
    role: "other",
    roleNote: "soporte",
    auth: "header",
    last4: "0b3d",
    status: "active",
    resources: 0,
  },
];

export type PolicyTemplate = "public" | "authenticated" | "owner" | "ownerOrAdmin" | "admin";

export interface PolicyRow {
  id: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  template: PolicyTemplate;
  ownerField: string | null;
  confirmed: boolean;
}

export const SEED_POLICY: PolicyRow[] = [
  {
    id: "p1",
    method: "GET",
    path: "/orders",
    template: "authenticated",
    ownerField: null,
    confirmed: true,
  },
  {
    id: "p2",
    method: "POST",
    path: "/orders",
    template: "authenticated",
    ownerField: null,
    confirmed: true,
  },
  {
    id: "p3",
    method: "GET",
    path: "/orders/{orderId}",
    template: "ownerOrAdmin",
    ownerField: "orderId → userId",
    confirmed: true,
  },
  {
    id: "p4",
    method: "PATCH",
    path: "/orders/{orderId}",
    template: "owner",
    ownerField: "orderId → userId",
    confirmed: false,
  },
  {
    id: "p5",
    method: "DELETE",
    path: "/orders/{orderId}",
    template: "ownerOrAdmin",
    ownerField: "orderId → userId",
    confirmed: true,
  },
  {
    id: "p6",
    method: "POST",
    path: "/orders/{orderId}/returns",
    template: "owner",
    ownerField: "orderId → userId",
    confirmed: false,
  },
];

/** Operaciones del contrato que la política muestra como ya confirmadas fuera de esta muestra. */
export const POLICY_TOTAL = 42;
export const POLICY_CONFIRMED_OUTSIDE_SAMPLE = 38 - 4;
