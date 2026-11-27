import type { Severity } from "@/components/ui/severity";
import { createEnumAdapter } from "./adapter";

/** Estado de un hallazgo en la insignia C-05 (`Status.finding`). */
export type FindingStatus = "new" | "persistent" | "regression" | "resolved" | "acceptedRisk";

/** Estado de una ejecución en la insignia C-05 (`Status.run`). */
export type RunState = "queued" | "running" | "completed" | "cancelled" | "failed";

/** `FindingStatus` del contrato 0.6.0. */
export type ApiFindingStatus = "new" | "persistent" | "resolved" | "regression" | "accepted_risk";

const FINDING_STATUSES: Record<FindingStatus, ApiFindingStatus> = {
  new: "new",
  persistent: "persistent",
  regression: "regression",
  resolved: "resolved",
  acceptedRisk: "accepted_risk",
};

export const findingStatusAdapter = createEnumAdapter(
  "finding_status",
  FINDING_STATUSES,
  "persistent",
);

/** Estados abiertos (guía del frontend, sección 5.9): se envían juntos en `status`. */
export const OPEN_FINDING_STATUSES: readonly ApiFindingStatus[] = [
  "new",
  "persistent",
  "regression",
];

/** `Severity` del contrato: mismos valores que la interfaz. */
export type ApiSeverity = Severity;

const SEVERITIES: Record<Severity, ApiSeverity> = {
  critical: "critical",
  high: "high",
  medium: "medium",
  low: "low",
  info: "info",
};

export const severityAdapter = createEnumAdapter("severity", SEVERITIES, "info");

/** `RunStatus` del contrato: mismos valores que la interfaz. */
export type ApiRunStatus = RunState;

const RUN_STATUSES: Record<RunState, ApiRunStatus> = {
  queued: "queued",
  running: "running",
  completed: "completed",
  cancelled: "cancelled",
  failed: "failed",
};

export const runStatusAdapter = createEnumAdapter("run_status", RUN_STATUSES, "failed");
