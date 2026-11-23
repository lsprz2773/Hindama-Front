import { MAX_STATS_DAYS } from "@/lib/api/schemas/admin";

export type StatsPeriod = "7" | "30" | "90" | "custom";
export type StatsGroup = "day" | "week";

const DAY_MS = 86_400_000;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** `YYYY-MM-DD` de un día que existe (el 31 de febrero no). */
const isDay = (value: string) =>
  DAY.test(value) &&
  !Number.isNaN(Date.parse(value)) &&
  utcDay(new Date(Date.parse(value))) === value;

/** Las fechas de `getAdminStats` son días en UTC. */
export const utcDay = (date: Date) => date.toISOString().slice(0, 10);

export function addDays(day: string, days: number): string {
  return utcDay(new Date(Date.parse(day) + days * DAY_MS));
}

/** Días que abarca el rango (ambas fechas se incluyen). */
export const spanDays = (from: string, to: string) =>
  Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS) + 1;

/** Hasta un mes, la serie va por día; más allá, por semana (cada punto sería ilegible). */
export const groupFor = (from: string, to: string): StatsGroup =>
  spanDays(from, to) > 31 ? "week" : "day";

/** Un rango que la API aceptaría: fechas reales, sin invertir, sin pasar de hoy ni de 366 días. */
export function isValidRange(from: string, to: string, today: string): boolean {
  if (!isDay(from) || !isDay(to)) return false;
  return from <= to && to <= today && spanDays(from, to) <= MAX_STATS_DAYS;
}

/** «Últimos N días» termina hoy y se pide con `date_from`; `date_to` queda en su valor por omisión. */
export function presetRange(today: string, days: 7 | 30 | 90) {
  const dateFrom = addDays(today, -(days - 1));
  return { dateFrom, dateTo: today, group: groupFor(dateFrom, today) };
}

/** Categoría de OWASP de la API (`API1:2023`) → clave de los textos (`API1`). */
export const owaspKey = (category: string) => category.split(":")[0] ?? category;

/** Separación de las guías del eje vertical: 1, 2, 5, 10, 20, 50… hasta 5 guías. */
export function niceStep(max: number): number {
  if (max <= 5) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(max / 5));
  return [1, 2, 5, 10].map((m) => m * magnitude).find((step) => max / step <= 5) ?? magnitude * 10;
}
