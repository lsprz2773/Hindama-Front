/**
 * Datos de ejemplo del panel de administración (fase 7).
 * TODO(api): se reemplazan por las respuestas de la API; los tipos son el contrato esperado.
 * El panel solo recibe datos agregados y anónimos: nunca identifica analistas ni APIs.
 */
export const ADMIN_STUB = { name: "Ana Rivera", email: "ana@ejemplo.mx" } as const;

/** «Hoy» del ejemplo: los periodos terminan aquí. */
export const STATS_END = "2026-10-30";

export type StatsPeriod = "7" | "30" | "90" | "custom";

export interface StatsKpi {
  key: "users" | "projects" | "runs" | "resolution" | "deletedAccounts" | "regressions";
  value: string;
  /** Parámetros del texto de apoyo. */
  note: Record<string, number | string>;
}

export interface StatsSet {
  /** Los contadores van por día; los hallazgos por semana (AJ-25). */
  unit: "day" | "week";
  kpis: StatsKpi[];
  series: [label: string, value: number][];
  modules: [key: string, value: number][];
  owasp: [key: string, value: number][];
}

const MODULES_30: [string, number][] = [
  ["config", 412],
  ["objects", 268],
  ["auth", 195],
  ["properties", 121],
  ["functions", 96],
  ["resources", 64],
  ["sql", 18],
];
const OWASP_30: [string, number][] = [
  ["API8", 412],
  ["API1", 268],
  ["API2", 195],
  ["API3", 121],
  ["API5", 96],
  ["API4", 64],
];
const scale = (rows: [string, number][], factor: number) =>
  rows.map(([key, value]) => [key, Math.max(1, Math.round(value * factor))] as [string, number]);

export const STATS: Record<Exclude<StatsPeriod, "custom">, StatsSet> = {
  "7": {
    unit: "day",
    kpis: [
      { key: "users", value: "74", note: { count: 3 } },
      { key: "projects", value: "198", note: { count: 151 } },
      { key: "runs", value: "238", note: { cancelled: 9, failed: 1 } },
      { key: "resolution", value: "5.8", note: {} },
      { key: "deletedAccounts", value: "1", note: {} },
      { key: "regressions", value: "8", note: {} },
    ],
    series: [
      ["24 oct", 31],
      ["25 oct", 28],
      ["26 oct", 12],
      ["27 oct", 9],
      ["28 oct", 41],
      ["29 oct", 52],
      ["30 oct", 65],
    ],
    modules: scale(MODULES_30, 0.23),
    owasp: scale(OWASP_30, 0.23),
  },
  "30": {
    unit: "week",
    kpis: [
      { key: "users", value: "128", note: { count: 12 } },
      { key: "projects", value: "214", note: { count: 163 } },
      { key: "runs", value: "1,032", note: { cancelled: 41, failed: 6 } },
      { key: "resolution", value: "6.4", note: {} },
      { key: "deletedAccounts", value: "9", note: {} },
      { key: "regressions", value: "37", note: {} },
    ],
    series: [
      ["6 oct", 229],
      ["13 oct", 274],
      ["20 oct", 296],
      ["27 oct", 312],
    ],
    modules: MODULES_30,
    owasp: OWASP_30,
  },
  "90": {
    unit: "week",
    kpis: [
      { key: "users", value: "171", note: { count: 44 } },
      { key: "projects", value: "251", note: { count: 190 } },
      { key: "runs", value: "2,946", note: { cancelled: 117, failed: 19 } },
      { key: "resolution", value: "7.1", note: {} },
      { key: "deletedAccounts", value: "21", note: {} },
      { key: "regressions", value: "102", note: {} },
    ],
    series: [
      ["8 sep", 182],
      ["15 sep", 205],
      ["22 sep", 238],
      ["29 sep", 251],
      ["6 oct", 229],
      ["13 oct", 274],
      ["20 oct", 296],
      ["27 oct", 312],
    ],
    modules: scale(MODULES_30, 2.8),
    owasp: scale(OWASP_30, 2.8),
  },
};

// ——— Bitácora ————————————————————————————————————————————————————————————————

export type AuditAction =
  | "accountCreated"
  | "accountDeleted"
  | "projectCreated"
  | "projectVerified"
  | "projectDeleted"
  | "identityCreated"
  | "identityDeleted"
  | "runLaunched"
  | "runCancelled"
  | "riskAccepted"
  | "targetBlocked";

export const AUDIT_ACTIONS: AuditAction[] = [
  "accountCreated",
  "accountDeleted",
  "projectCreated",
  "projectVerified",
  "projectDeleted",
  "identityCreated",
  "identityDeleted",
  "runLaunched",
  "runCancelled",
  "riskAccepted",
  "targetBlocked",
];

export type AuditTone = "ok" | "warning" | "danger" | "progress";
export const ACTION_TONE: Record<AuditAction, AuditTone> = {
  accountCreated: "ok",
  accountDeleted: "danger",
  projectCreated: "ok",
  projectVerified: "ok",
  projectDeleted: "danger",
  identityCreated: "ok",
  identityDeleted: "danger",
  runLaunched: "progress",
  runCancelled: "warning",
  riskAccepted: "warning",
  targetBlocked: "danger",
};

export type DetailLabel =
  | "modules"
  | "limits"
  | "confirmedRisk"
  | "reason"
  | "reportedHost"
  | "requests"
  | "method"
  | "result"
  | "role"
  | "dismissReason"
  | "justification"
  | "identity"
  | "credential"
  | "by"
  | "permanentDelete"
  | "verification";

export type DetailMessage =
  | "limits"
  | "confirmedProperties"
  | "redirect"
  | "fingerprint"
  | "file"
  | "verified"
  | "analyst"
  | "accepted"
  | "notStored"
  | "notRecorded"
  | "user"
  | "pending";

/** Un valor del detalle: texto literal o una clave de mensaje (`AuditLog.values`). */
export type AuditValue = { raw: string } | { msg: DetailMessage };
export interface AuditDetail {
  label: DetailLabel;
  value: AuditValue;
}

/** Identificador opaco del usuario: se muestra abreviado y se copia completo. */
export interface AuditUser {
  id: string;
  deleted?: boolean;
  /** Solo para el ejemplo: el servidor resuelve el correo y no lo devuelve. */
  email?: string;
}

export const USERS: Record<"luis" | "maria" | "jorge" | "carla" | "diego", AuditUser> = {
  luis: { id: "usr_3f9a7c0d51b84e2ac21e", email: "luis@ejemplo.mx" },
  maria: { id: "usr_b81d44f0a9e3600d07a4", email: "maria@ejemplo.mx" },
  jorge: { id: "usr_5e02c73b1f6a4d1c9d6b", email: "jorge@ejemplo.mx" },
  carla: { id: "usr_a47c0e5d82b9317fe180", email: "carla@ejemplo.mx" },
  diego: { id: "usr_d90f6b2e43a1587c3b52", deleted: true },
};

export function abbreviateId(id: string): string {
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

/** Huella (FNV-1a) para comparar hosts sin mostrarlos. TODO(api): HMAC con clave del servidor. */
export function hostFingerprint(host: string): string {
  let h = 0x811c9dc5;
  for (const ch of host.trim().toLowerCase()) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

export interface AuditRecord {
  id: string;
  /** Fecha y hora (ISO, UTC). */
  at: string;
  user: AuditUser;
  action: AuditAction;
  /** Identificador opaco del proyecto o `null`. */
  project: string | null;
  ip: string;
  detail: AuditDetail[];
  /** Huella del host reportado (solo «Destino bloqueado»). */
  hostFp?: string;
}

/** Host de ejemplo cuya huella coincide con los registros de «Destino bloqueado». */
export const SAMPLE_BLOCKED_HOST = "api.interno.ejemplo.mx";

const BASE: Omit<AuditRecord, "id" | "at">[] = [
  {
    user: USERS.luis,
    action: "runLaunched",
    project: "prj_7Q4K",
    ip: "189.203.14.7",
    detail: [
      { label: "modules", value: { raw: "API2, API8, API1, API3" } },
      { label: "limits", value: { msg: "limits" } },
      { label: "confirmedRisk", value: { msg: "confirmedProperties" } },
    ],
  },
  {
    user: USERS.luis,
    action: "targetBlocked",
    project: "prj_7Q4K",
    ip: "189.203.14.7",
    hostFp: hostFingerprint(SAMPLE_BLOCKED_HOST),
    detail: [
      { label: "reason", value: { msg: "redirect" } },
      { label: "reportedHost", value: { msg: "fingerprint" } },
      { label: "requests", value: { raw: "3" } },
    ],
  },
  {
    user: USERS.luis,
    action: "projectVerified",
    project: "prj_7Q4K",
    ip: "189.203.14.7",
    detail: [
      { label: "method", value: { msg: "file" } },
      { label: "result", value: { msg: "verified" } },
    ],
  },
  {
    user: USERS.maria,
    action: "accountCreated",
    project: null,
    ip: "201.141.88.20",
    detail: [{ label: "role", value: { msg: "analyst" } }],
  },
  {
    user: USERS.jorge,
    action: "riskAccepted",
    project: "prj_2M9X",
    ip: "187.190.3.61",
    detail: [
      { label: "dismissReason", value: { msg: "accepted" } },
      { label: "justification", value: { msg: "notStored" } },
    ],
  },
  {
    user: USERS.luis,
    action: "identityCreated",
    project: "prj_7Q4K",
    ip: "189.203.14.7",
    detail: [
      { label: "identity", value: { raw: "Soporte" } },
      { label: "credential", value: { msg: "notRecorded" } },
    ],
  },
  {
    user: USERS.carla,
    action: "runCancelled",
    project: "prj_K31P",
    ip: "148.204.55.2",
    detail: [{ label: "by", value: { msg: "user" } }],
  },
  {
    user: USERS.jorge,
    action: "projectDeleted",
    project: "prj_9WQ2",
    ip: "187.190.3.61",
    detail: [{ label: "permanentDelete", value: { raw: "2026-11-27" } }],
  },
  {
    user: USERS.carla,
    action: "projectCreated",
    project: "prj_K31P",
    ip: "148.204.55.2",
    detail: [{ label: "verification", value: { msg: "pending" } }],
  },
  {
    user: USERS.diego,
    action: "accountDeleted",
    project: null,
    ip: "201.103.77.9",
    detail: [{ label: "permanentDelete", value: { raw: "2026-11-26" } }],
  },
];

/** 34 registros: los diez del diseño y sus variaciones, del más reciente al más antiguo. TODO(api). */
export const AUDIT_RECORDS: AuditRecord[] = Array.from({ length: 34 }, (_, i) => {
  const base = BASE[i % BASE.length];
  const minutes = i * 197 + (i % 3) * 11;
  const at = new Date(
    Date.UTC(2026, 9, 30, 11, 2, 14) - minutes * 60_000 - i * 1_000,
  ).toISOString();
  return { ...base, id: `log_${String(i + 1).padStart(3, "0")}`, at };
});
