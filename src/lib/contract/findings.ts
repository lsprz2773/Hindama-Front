import { createEnumAdapter } from "./adapter";

/** Motivo de descarte en la interfaz (`Finding.reason` de los datos de ejemplo). */
export type UiDismissalReason = "accepted" | "false_positive";
/** `DismissalReason` del contrato 0.6.0. */
export type ApiDismissalReason = "accepted_risk" | "false_positive";

const DISMISSAL_REASONS: Record<UiDismissalReason, ApiDismissalReason> = {
  accepted: "accepted_risk",
  false_positive: "false_positive",
};

export const dismissalReasonAdapter = createEnumAdapter(
  "dismissal_reason",
  DISMISSAL_REASONS,
  "accepted",
);

/** `ResolutionReason` del contrato: la interfaz aún no tiene un tipo propio, usa los mismos. */
export type ApiResolutionReason = "not_detected" | "identity_deleted" | "operation_retired";

const RESOLUTION_REASONS: Record<ApiResolutionReason, ApiResolutionReason> = {
  not_detected: "not_detected",
  identity_deleted: "identity_deleted",
  operation_retired: "operation_retired",
};

export const resolutionReasonAdapter = createEnumAdapter(
  "resolution_reason",
  RESOLUTION_REASONS,
  "not_detected",
);
