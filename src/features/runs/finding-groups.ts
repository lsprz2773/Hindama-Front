const SEVERITY_ORDER = ["critical", "high", "medium", "low", "info"] as const;

/**
 * Agrupa los hallazgos por `finding_type` (B21): el título lo define la comprobación y no incluye la
 * operación ni la identidad, así que un mismo título puede repetirse una vez por cada una. El
 * contrato garantiza que el mismo tipo tiene siempre el mismo título.
 */
export function groupByType<
  T extends { finding_type: string; title: string; severity: (typeof SEVERITY_ORDER)[number] },
>(items: readonly T[]) {
  const groups = new Map<string, { title: string; severity: T["severity"]; count: number }>();
  for (const item of items) {
    const group = groups.get(item.finding_type);
    if (!group) {
      groups.set(item.finding_type, { title: item.title, severity: item.severity, count: 1 });
      continue;
    }
    group.count += 1;
    if (SEVERITY_ORDER.indexOf(item.severity) < SEVERITY_ORDER.indexOf(group.severity))
      group.severity = item.severity;
  }
  return [...groups.entries()]
    .map(([type, group]) => ({ type, ...group }))
    .sort(
      (a, b) =>
        SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity) ||
        b.count - a.count,
    );
}
