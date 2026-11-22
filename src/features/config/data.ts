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
