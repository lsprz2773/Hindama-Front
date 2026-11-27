import type { AuditAction } from "@/lib/api/schemas/admin";

export type AuditTone = "ok" | "warning" | "danger" | "progress";

/** Color de cada acción: el color siempre va acompañado del texto de la acción (RNF-15). */
export const ACTION_TONE: Record<AuditAction, AuditTone> = {
  account_created: "ok",
  account_deleted: "danger",
  project_created: "ok",
  project_deleted: "danger",
  project_verified: "ok",
  project_verification_lost: "warning",
  identity_created: "ok",
  identity_deleted: "danger",
  run_launched: "progress",
  run_cancelled: "warning",
  finding_dismissed: "warning",
  finding_dismissal_reverted: "progress",
  destination_blocked: "danger",
};

/** Identificador opaco abreviado: se muestra corto y se copia completo. */
export function abbreviateId(id: string): string {
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** La API filtra por el `id` interno completo; no resuelve correos ni fragmentos. */
export function isUserId(value: string): boolean {
  return UUID.test(value.trim());
}

/** Inicio, en la zona del navegador, del día `YYYY-MM-DD` más `offsetDays` (RFC 3339 en UTC). */
export function startOfDay(day: string, offsetDays = 0): string | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return undefined;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + offsetDays);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}
