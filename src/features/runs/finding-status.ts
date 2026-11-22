import type { StatusOf } from "@/components/ui/status-badge";
import type { FindingStatus } from "@/lib/api/schemas/findings";

/** Estados de `FindingStatus` en el orden de los filtros: abiertos primero (RF-69). */
export const FINDING_STATUSES: FindingStatus[] = [
  "new",
  "persistent",
  "regression",
  "resolved",
  "accepted_risk",
];

/** `FindingStatus` del contrato → estado de la insignia C-05. */
export function badgeStatus(status: FindingStatus): StatusOf<"finding"> {
  return status === "accepted_risk" ? "acceptedRisk" : status;
}
