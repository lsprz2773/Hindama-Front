import type { Severity } from "@/components/ui/severity";

/**
 * Proyectos de ejemplo y su almacén temporal.
 * TODO(api): sustituir por las llamadas a la API; las firmas de las funciones se conservan.
 * Mientras tanto el estado vive en sessionStorage para poder probar los flujos completos.
 */
export interface ModuleResult {
  code: string;
  key: "auth" | "config" | "objects" | "functions" | "properties" | "resources" | "sql";
  /** Hallazgos de la última ejecución; `null` = no se ejecutó. */
  findings: number | null;
  blocked?: boolean;
}

export interface ProjectReport {
  runNumber: number;
  date: string;
  requests: number;
  minutes: string;
  modulesRun: number;
  /** Abiertos por severidad: crítica, alta, media, baja, informativa. */
  severities: [number, number, number, number, number];
  modules: ModuleResult[];
  criticalNote?: boolean;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  baseUrl: string;
  verified: boolean;
  concluded: boolean;
  /** Ejecución en curso (progreso 0-100). */
  running?: number;
  /** Fecha de la última ejecución (ISO) o `null`. */
  lastRun: string | null;
  openFindings: number | null;
  policy: { confirmed: number; total: number } | null;
  contractOps: number | null;
  identities: number;
  resources: number;
  report: ProjectReport | null;
  createdAt: string;
}

export const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low", "info"];

const FULL_MODULES: ModuleResult[] = [
  { code: "API2", key: "auth", findings: 2 },
  { code: "API8", key: "config", findings: 7 },
  { code: "API1", key: "objects", findings: 3 },
  { code: "API5", key: "functions", findings: null, blocked: true },
  { code: "API3", key: "properties", findings: 3 },
  { code: "API4", key: "resources", findings: null },
  { code: "SQL", key: "sql", findings: null },
];

export const SEED_PROJECTS: Project[] = [
  {
    id: "pedidos",
    name: "API de Pedidos",
    description: "Pedidos, facturas y envíos del ambiente de staging.",
    baseUrl: "https://api.pedidos-staging.ejemplo.mx",
    verified: true,
    concluded: false,
    lastRun: "2026-10-28",
    openFindings: 15,
    policy: { confirmed: 38, total: 42 },
    contractOps: 42,
    identities: 3,
    resources: 18,
    createdAt: "2026-09-12",
    report: {
      runNumber: 3,
      date: "2026-10-28",
      requests: 1284,
      minutes: "6:12",
      modulesRun: 4,
      severities: [1, 3, 4, 2, 5],
      modules: FULL_MODULES,
      criticalNote: true,
    },
  },
  {
    id: "inventario",
    name: "API de Inventario",
    description: "Existencias y movimientos de almacén.",
    baseUrl: "https://inventario.qa.ejemplo.mx/v1",
    verified: true,
    concluded: false,
    running: 58,
    lastRun: null,
    openFindings: 7,
    policy: { confirmed: 20, total: 20 },
    contractOps: 20,
    identities: 2,
    resources: 9,
    createdAt: "2026-10-01",
    report: null,
  },
  {
    id: "pagos",
    name: "API de Pagos",
    description: "Cobros con tarjeta y reembolsos del ambiente de pruebas.",
    baseUrl: "http://api.pagos-staging.ejemplo.mx",
    verified: false,
    concluded: false,
    lastRun: null,
    openFindings: null,
    policy: null,
    contractOps: null,
    identities: 0,
    resources: 0,
    createdAt: "2026-10-20",
    report: null,
  },
  {
    id: "proveedores",
    name: "Portal de proveedores",
    description: "Alta y consulta de proveedores.",
    baseUrl: "https://proveedores.ejemplo.mx/api",
    verified: false,
    concluded: true,
    lastRun: "2026-09-02",
    openFindings: 0,
    policy: { confirmed: 12, total: 12 },
    contractOps: 12,
    identities: 2,
    resources: 5,
    createdAt: "2026-08-15",
    report: {
      runNumber: 2,
      date: "2026-09-02",
      requests: 640,
      minutes: "3:40",
      modulesRun: 7,
      severities: [0, 0, 0, 0, 0],
      modules: FULL_MODULES.map((m) => ({ ...m, findings: 0, blocked: false })),
    },
  },
];
