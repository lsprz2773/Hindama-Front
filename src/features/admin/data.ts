/**
 * Datos de ejemplo de las estadísticas del administrador (V-33).
 * TODO(api): se reemplazan por la respuesta de la API cuando exista `GET /admin/stats` (RF-78);
 * los tipos son el contrato esperado. La bitácora (V-34) ya usa `listAuditLog`.
 * El panel solo recibe datos agregados y anónimos: nunca identifica analistas ni APIs.
 */

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
