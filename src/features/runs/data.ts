import type { Severity } from "@/components/ui/severity";
import type { ProjectReport } from "@/features/projects/seed";

/**
 * Datos de ejemplo de ejecuciones y hallazgos (fase 5).
 * TODO(api): se reemplazan por las respuestas de la API; los tipos son el contrato esperado.
 */
export type FindingStatus = "new" | "persistent" | "regression" | "resolved" | "acceptedRisk";
export type ModuleKey =
  "auth" | "config" | "objects" | "functions" | "properties" | "resources" | "sql";

export interface Finding {
  id: string;
  severity: Severity;
  title: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "API";
  path: string;
  module: ModuleKey;
  identity: string;
  owasp: string;
  cwe: string;
  status: FindingStatus;
  /** Estado previo a aceptar el riesgo; a él vuelve al revertir. */
  before?: FindingStatus;
  /** Solo cuando el estado es «riesgo aceptado»: el motivo elegido. */
  reason?: "accepted" | "false_positive";
  justification?: string;
}

export const SEED_FINDINGS: Finding[] = [
  {
    id: "f01",
    severity: "critical",
    title: "Un usuario puede leer pedidos de otro usuario",
    method: "GET",
    path: "/orders/{orderId}",
    module: "objects",
    identity: "Soporte",
    owasp: "API1:2023",
    cwe: "CWE-639",
    status: "persistent",
  },
  {
    id: "f02",
    severity: "high",
    title: "El token vencido sigue siendo aceptado",
    method: "GET",
    path: "/orders",
    module: "auth",
    identity: "Cliente A",
    owasp: "API2:2023",
    cwe: "CWE-613",
    status: "new",
  },
  {
    id: "f03",
    severity: "high",
    title: "PATCH /orders acepta el campo «status»",
    method: "PATCH",
    path: "/orders/{orderId}",
    module: "properties",
    identity: "Cliente A",
    owasp: "API3:2023",
    cwe: "CWE-915",
    status: "new",
  },
  {
    id: "f04",
    severity: "high",
    title: "Un usuario normal lista todos los pedidos",
    method: "GET",
    path: "/admin/orders",
    module: "objects",
    identity: "Soporte",
    owasp: "API5:2023",
    cwe: "CWE-285",
    status: "regression",
  },
  {
    id: "f05",
    severity: "medium",
    title: "CORS permite cualquier origen con credenciales",
    method: "GET",
    path: "/orders",
    module: "config",
    identity: "Anónima",
    owasp: "API8:2023",
    cwe: "CWE-942",
    status: "persistent",
  },
  {
    id: "f06",
    severity: "medium",
    title: "La factura se descarga sin autenticarse",
    method: "GET",
    path: "/orders/{orderId}/invoice",
    module: "objects",
    identity: "Anónima",
    owasp: "API1:2023",
    cwe: "CWE-306",
    status: "regression",
  },
  {
    id: "f07",
    severity: "medium",
    title: "El error 500 expone la traza del servidor",
    method: "POST",
    path: "/orders",
    module: "config",
    identity: "Cliente A",
    owasp: "API8:2023",
    cwe: "CWE-209",
    status: "persistent",
  },
  {
    id: "f08",
    severity: "medium",
    title: "Los listados no limitan el tamaño de página",
    method: "GET",
    path: "/orders",
    module: "properties",
    identity: "Cliente A",
    owasp: "API4:2023",
    cwe: "CWE-770",
    status: "acceptedRisk",
    before: "new",
    reason: "accepted",
    justification: "Se corrige en el siguiente sprint; el volumen actual es bajo.",
  },
  {
    id: "f09",
    severity: "low",
    title: "Falta la cabecera Strict-Transport-Security",
    method: "GET",
    path: "/health",
    module: "config",
    identity: "Anónima",
    owasp: "API8:2023",
    cwe: "CWE-319",
    status: "persistent",
  },
  {
    id: "f10",
    severity: "low",
    title: "Falta la cabecera X-Content-Type-Options",
    method: "GET",
    path: "/health",
    module: "config",
    identity: "Anónima",
    owasp: "API8:2023",
    cwe: "CWE-693",
    status: "acceptedRisk",
    before: "persistent",
    reason: "false_positive",
    justification: "El balanceador agrega la cabecera; la API la recibe.",
  },
  {
    id: "f11",
    severity: "info",
    title: "El servidor anuncia su versión",
    method: "GET",
    path: "/health",
    module: "config",
    identity: "Anónima",
    owasp: "API8:2023",
    cwe: "CWE-200",
    status: "persistent",
  },
  {
    id: "f12",
    severity: "info",
    title: "La respuesta incluye cabeceras X-Powered-By",
    method: "GET",
    path: "/orders",
    module: "config",
    identity: "Anónima",
    owasp: "API8:2023",
    cwe: "CWE-200",
    status: "acceptedRisk",
    before: "persistent",
    reason: "accepted",
    justification: "Cabecera informativa, sin impacto en este ambiente.",
  },
  {
    id: "f13",
    severity: "info",
    title: "OPTIONS responde con métodos no documentados",
    method: "API",
    path: "Toda la API",
    module: "config",
    identity: "Anónima",
    owasp: "API9:2023",
    cwe: "CWE-16",
    status: "acceptedRisk",
    before: "persistent",
    reason: "accepted",
    justification: "Los métodos extra son del balanceador.",
  },
  {
    id: "f14",
    severity: "info",
    title: "Falta la cabecera Referrer-Policy",
    method: "GET",
    path: "/health",
    module: "config",
    identity: "Anónima",
    owasp: "API8:2023",
    cwe: "CWE-200",
    status: "resolved",
  },
  {
    id: "f15",
    severity: "info",
    title: "Los errores 404 distinguen entre ruta y objeto",
    method: "GET",
    path: "/orders/{orderId}",
    module: "auth",
    identity: "Cliente A",
    owasp: "API8:2023",
    cwe: "CWE-204",
    status: "resolved",
  },
];

export const FINDING_STATUS_ORDER: FindingStatus[] = [
  "new",
  "persistent",
  "regression",
  "acceptedRisk",
  "resolved",
];

export interface RunSummary {
  number: number;
  date: string;
  requests: number;
  minutes: string;
  modulesRun: number;
  blocked: number;
  comparison: { new: number; persistent: number; resolved: number; regression: number };
  severities: [number, number, number, number, number];
}

export const SAMPLE_RUN: RunSummary = {
  number: 3,
  date: "2026-10-28",
  requests: 1284,
  minutes: "6:12",
  modulesRun: 4,
  blocked: 0,
  comparison: { new: 4, persistent: 9, resolved: 6, regression: 2 },
  severities: [1, 3, 4, 2, 5],
};

export type CellKind = "allow" | "deny" | "discrepancy" | "error" | "na" | "expired";

export interface MatrixRow {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "API";
  path: string;
  template: "authenticated" | "ownerOrAdmin" | "owner" | "admin" | "public" | "global";
  cells: { kind: CellKind; code?: string; finding?: string }[];
  /** La ruta se prueba con el recurso de esta identidad («de Cliente A»). */
  ownedBy?: string;
}

export const MATRIX_IDENTITIES = [
  { name: "Anónima", role: "unauthenticated" },
  { name: "Cliente A", role: "owner" },
  { name: "Cliente B", role: "user" },
  { name: "Soporte", role: "other" },
] as const;

export const SAMPLE_MATRIX: MatrixRow[] = [
  {
    method: "GET",
    path: "/orders",
    template: "authenticated",
    cells: [
      { kind: "deny", code: "401" },
      { kind: "allow", code: "200" },
      { kind: "expired" },
      { kind: "allow", code: "200" },
    ],
  },
  {
    method: "POST",
    path: "/orders",
    template: "authenticated",
    cells: [
      { kind: "deny", code: "401" },
      { kind: "allow", code: "201" },
      { kind: "expired" },
      { kind: "allow", code: "201" },
    ],
  },
  {
    method: "GET",
    path: "/orders/{orderId}",
    ownedBy: "Cliente A",
    template: "ownerOrAdmin",
    cells: [
      { kind: "deny", code: "401" },
      { kind: "allow", code: "200" },
      { kind: "expired" },
      { kind: "discrepancy", code: "200", finding: "f01" },
    ],
  },
  {
    method: "PATCH",
    path: "/orders/{orderId}",
    ownedBy: "Cliente A",
    template: "owner",
    cells: [
      { kind: "deny", code: "401" },
      { kind: "allow", code: "200" },
      { kind: "expired" },
      { kind: "deny", code: "403" },
    ],
  },
  {
    method: "DELETE",
    path: "/orders/{orderId}",
    ownedBy: "Cliente A",
    template: "ownerOrAdmin",
    cells: [
      { kind: "deny", code: "401" },
      { kind: "allow", code: "204" },
      { kind: "expired" },
      { kind: "deny", code: "404" },
    ],
  },
  {
    method: "GET",
    path: "/orders/{orderId}/invoice",
    template: "ownerOrAdmin",
    cells: [
      { kind: "discrepancy", code: "200", finding: "f06" },
      { kind: "allow", code: "200" },
      { kind: "expired" },
      { kind: "deny", code: "403" },
    ],
  },
  {
    method: "GET",
    path: "/admin/orders",
    template: "admin",
    cells: [
      { kind: "deny", code: "401" },
      { kind: "deny", code: "403" },
      { kind: "expired" },
      { kind: "discrepancy", code: "200", finding: "f04" },
    ],
  },
  {
    method: "PUT",
    path: "/admin/orders/{orderId}/status",
    template: "admin",
    cells: [
      { kind: "deny", code: "401" },
      { kind: "deny", code: "403" },
      { kind: "expired" },
      { kind: "error", code: "timeout" },
    ],
  },
  {
    method: "GET",
    path: "/health",
    template: "public",
    cells: [
      { kind: "allow", code: "200" },
      { kind: "allow", code: "200" },
      { kind: "allow", code: "200" },
      { kind: "allow", code: "200" },
    ],
  },
  {
    method: "API",
    path: "global",
    template: "global",
    cells: [
      { kind: "discrepancy", code: "cors", finding: "f05" },
      { kind: "na" },
      { kind: "na" },
      { kind: "na" },
    ],
  },
];

export const RUN_MODULES: {
  code: string;
  key: ModuleKey;
  risk?: "medium" | "high";
  blockedNoAdmin?: boolean;
  defaultOn: boolean;
}[] = [
  { code: "API2", key: "auth", defaultOn: true },
  { code: "API8", key: "config", defaultOn: true },
  { code: "API1", key: "objects", defaultOn: true },
  { code: "API5", key: "functions", blockedNoAdmin: true, defaultOn: false },
  { code: "API3", key: "properties", risk: "medium", defaultOn: false },
  { code: "API4", key: "resources", risk: "medium", defaultOn: false },
  { code: "SQL", key: "sql", risk: "high", defaultOn: false },
];

export const RUN_LIMITS = [
  { key: "rps", value: 5, max: 20 },
  { key: "concurrency", value: 2, max: 5 },
  { key: "total", value: 2000, max: 5000 },
  { key: "duration", value: 15, max: 30 },
] as const;

export const SAMPLE_PENDING_RESOURCES = [
  {
    operation: "POST /orders",
    location: "/orders/8f21",
    attempts: 3,
    lastError: "Tiempo de espera agotado (504)",
  },
  {
    operation: "POST /users",
    location: "/users/412",
    attempts: 3,
    lastError: "Acceso denegado (403)",
  },
  {
    operation: "POST /files",
    location: "/files/9c1d",
    attempts: 3,
    lastError: "Conexión rechazada",
  },
];

const NL = "\n";

export const EVIDENCE = {
  request: [
    "GET /orders/1042 HTTP/1.1",
    "Host: api.pedidos-staging.ejemplo.mx",
    "Authorization: Bearer ••••••••••a9F2",
    "Accept: application/json",
  ].join("\n"),
  response: [
    "HTTP/1.1 200 OK",
    "Content-Type: application/json",
    "",
    "{",
    '  "id": 1042,',
    '  "owner_id": "usr_A_3f81",',
    '  "status": "enviado",',
    '  "total": 1849.00,',
    '  "shipping_address": "Av. Reforma 222, CDMX"',
    "}",
  ].join("\n"),
  curl: "curl https://api.pedidos-staging.ejemplo.mx/orders/1042 -H 'Authorization: Bearer ****a9F2'",
};

export const FINDING_HISTORY = [
  { run: 3, date: "2026-10-28", status: "persistent" as const },
  { run: 2, date: "2026-10-21", status: "persistent" as const },
  { run: 1, date: "2026-10-14", status: "new" as const },
];

/** Datos de la prueba de cada hallazgo de ejemplo. TODO(api): vienen en el detalle del hallazgo. */
export const FINDING_EXTRA: Record<
  string,
  { policy: "owner" | "admin" | "authenticated" | "public" | "global"; observed: string }
> = {
  f01: { policy: "owner", observed: "200" },
  f02: { policy: "authenticated", observed: "200" },
  f03: { policy: "owner", observed: "200" },
  f04: { policy: "admin", observed: "200" },
  f05: { policy: "global", observed: "200" },
  f06: { policy: "authenticated", observed: "200" },
  f07: { policy: "authenticated", observed: "500" },
  f08: { policy: "authenticated", observed: "200" },
  f09: { policy: "global", observed: "200" },
  f10: { policy: "global", observed: "200" },
  f11: { policy: "global", observed: "200" },
  f12: { policy: "global", observed: "200" },
  f13: { policy: "global", observed: "200" },
  f14: { policy: "global", observed: "200" },
  f15: { policy: "authenticated", observed: "404" },
};

/** Evidencia de la petición y la respuesta. Solo el primer hallazgo trae un ejemplo completo. */
export function evidenceFor(finding: Finding, baseUrl: string) {
  if (finding.id === "f01") return EVIDENCE;
  const host = baseUrl.replace(/^https?:\/\//, "").split("/")[0];
  const code = FINDING_EXTRA[finding.id]?.observed ?? "200";
  const reason = code === "200" ? "OK" : code === "404" ? "Not Found" : "Internal Server Error";
  const method = finding.method === "API" ? "OPTIONS" : finding.method;
  const path = finding.path === "Toda la API" ? "/" : finding.path;
  const request = [`${method} ${path} HTTP/1.1`, `Host: ${host}`, "Accept: application/json"].join(
    NL,
  );
  const response = [
    `HTTP/1.1 ${code} ${reason}`,
    "Content-Type: application/json",
    "Server: nginx/1.18.0",
    "",
    "{ ... }",
  ].join(NL);
  return {
    request,
    response,
    curl: `curl -X ${method} https://${host}${path} -H 'Accept: application/json'`,
  };
}

/** Historial del hallazgo entre ejecuciones. TODO(api). */
export function historyFor(
  status: FindingStatus,
): { run: number; date: string; status: FindingStatus }[] {
  if (status === "new") return [{ run: 3, date: "2026-10-28", status: "new" }];
  if (status === "regression")
    return [
      { run: 3, date: "2026-10-28", status: "regression" },
      { run: 2, date: "2026-10-21", status: "resolved" },
      { run: 1, date: "2026-10-14", status: "new" },
    ];
  return FINDING_HISTORY.map((h) => ({ ...h }));
}

/** Reporte de una ejecución recién terminada cuando el proyecto aún no tenía uno. TODO(api). */
export const DEFAULT_REPORT: ProjectReport = {
  runNumber: 1,
  date: "2026-11-18",
  requests: 2000,
  minutes: "6:12",
  modulesRun: 4,
  severities: [0, 1, 2, 3, 1],
  modules: [
    { code: "API2", key: "auth", findings: 2 },
    { code: "API8", key: "config", findings: 3 },
    { code: "API1", key: "objects", findings: 2 },
    { code: "API5", key: "functions", findings: null, blocked: true },
    { code: "API3", key: "properties", findings: 0 },
    { code: "API4", key: "resources", findings: null },
    { code: "SQL", key: "sql", findings: null },
  ],
};
