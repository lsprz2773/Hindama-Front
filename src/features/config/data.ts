/**
 * Datos de ejemplo de la configuración de un proyecto (fase 4).
 * TODO(api): se reemplazan por las respuestas de la API; los tipos son el contrato esperado.
 */


export interface Operation {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  summary: string;
  params: string;
  security: "bearer" | "public";
}

export const SAMPLE_OPERATIONS: Operation[] = [
  {
    method: "GET",
    path: "/orders",
    summary: "Lista los pedidos del usuario",
    params: "3 consulta",
    security: "bearer",
  },
  {
    method: "POST",
    path: "/orders",
    summary: "Crea un pedido",
    params: "Cuerpo",
    security: "bearer",
  },
  {
    method: "GET",
    path: "/orders/{orderId}",
    summary: "Obtiene un pedido",
    params: "1 ruta · 1 consulta",
    security: "bearer",
  },
  {
    method: "PATCH",
    path: "/orders/{orderId}",
    summary: "Actualiza la dirección",
    params: "1 ruta · cuerpo",
    security: "bearer",
  },
  {
    method: "DELETE",
    path: "/orders/{orderId}",
    summary: "Cancela un pedido",
    params: "1 ruta",
    security: "bearer",
  },
  {
    method: "GET",
    path: "/orders/{orderId}/invoice",
    summary: "Descarga la factura",
    params: "1 ruta",
    security: "bearer",
  },
  {
    method: "GET",
    path: "/admin/orders",
    summary: "Todos los pedidos",
    params: "4 consulta",
    security: "bearer",
  },
  {
    method: "PUT",
    path: "/admin/orders/{orderId}/status",
    summary: "Cambia el estado",
    params: "1 ruta · cuerpo",
    security: "bearer",
  },
  {
    method: "GET",
    path: "/health",
    summary: "Estado del servicio",
    params: "Ninguno",
    security: "public",
  },
];

export interface ContractVersion {
  name: string;
  date: string;
  origin: string;
  operations: number;
}

export const CONTRACT_VERSIONS: ContractVersion[] = [
  { name: "v2.4.0", date: "2026-10-21", origin: "pedidos-v2.4.yaml", operations: 42 },
  { name: "v2.3.1", date: "2026-10-09", origin: "URL", operations: 40 },
  { name: "v2.2.0", date: "2026-10-01", origin: "file", operations: 37 },
];

export interface Change {
  kind: "added" | "modified" | "removed";
  method: Operation["method"];
  path: string;
  detail?: string;
}

export const CHANGES_VS_V231: Change[] = [
  { kind: "added", method: "GET", path: "/orders/{orderId}/tracking" },
  { kind: "added", method: "POST", path: "/orders/{orderId}/returns" },
  { kind: "added", method: "GET", path: "/admin/returns" },
  { kind: "modified", method: "PATCH", path: "/orders/{orderId}", detail: "patch" },
  { kind: "modified", method: "GET", path: "/orders", detail: "list" },
  { kind: "modified", method: "DELETE", path: "/orders/{orderId}", detail: "delete" },
  { kind: "modified", method: "GET", path: "/health", detail: "health" },
  { kind: "removed", method: "GET", path: "/orders/export" },
];

export const CHANGES_VS_V220: Change[] = [
  ...CHANGES_VS_V231,
  { kind: "added", method: "GET", path: "/orders/{orderId}/events" },
  { kind: "added", method: "PUT", path: "/orders/{orderId}/address" },
  { kind: "removed", method: "DELETE", path: "/orders/bulk" },
];

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

export interface ResourceParam {
  path: string;
  param: string;
  kind: "order" | "user" | "address" | "none";
  on: boolean;
}

export const SEED_PARAMS: ResourceParam[] = [
  { path: "/orders/{orderId}", param: "orderId", kind: "order", on: true },
  { path: "/orders/{orderId}/invoice", param: "orderId", kind: "order", on: true },
  { path: "/users/{userId}/addresses/{addressId}", param: "userId", kind: "user", on: true },
  { path: "/users/{userId}/addresses/{addressId}", param: "addressId", kind: "address", on: true },
  { path: "/products/{sku}", param: "sku", kind: "none", on: false },
  { path: "/admin/orders/{orderId}/status", param: "orderId", kind: "order", on: true },
];

export interface ResourceRow {
  id: string;
  kind: "order" | "user" | "address";
  value: string;
  origin: "discovered" | "manual";
  confirmed: boolean;
}

export const SEED_RESOURCES: Record<string, ResourceRow[]> = {
  "cliente-a": [
    { id: "a1", kind: "order", value: "8f21c0de", origin: "discovered", confirmed: true },
    { id: "a2", kind: "order", value: "93ad1f02", origin: "discovered", confirmed: true },
    { id: "a3", kind: "order", value: "c4e8770a", origin: "discovered", confirmed: false },
    { id: "a4", kind: "user", value: "usr_1042", origin: "discovered", confirmed: true },
    { id: "a5", kind: "address", value: "adr_77", origin: "manual", confirmed: true },
  ],
  "cliente-b": [
    { id: "b1", kind: "order", value: "1b7e44a0", origin: "discovered", confirmed: true },
    { id: "b2", kind: "order", value: "5c02e9b1", origin: "discovered", confirmed: true },
    { id: "b3", kind: "order", value: "aa31d2f7", origin: "discovered", confirmed: false },
    { id: "b4", kind: "user", value: "usr_1043", origin: "discovered", confirmed: true },
    { id: "b5", kind: "address", value: "adr_81", origin: "manual", confirmed: true },
  ],
  soporte: [],
};

export type PolicyTemplate = "public" | "authenticated" | "owner" | "ownerOrAdmin" | "admin";

export interface PolicyRow {
  id: string;
  method: Operation["method"];
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
