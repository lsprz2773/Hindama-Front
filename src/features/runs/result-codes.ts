/**
 * Vocabulario de `Result.expected` y `Result.observed` (catálogo del motor, secciones 3.1 y 4). El
 * contrato solo da algunos como ejemplo, pero el motor emite todos estos: se traducen si se
 * conocen y, si no, se muestran tal cual. `observed` puede traer un estado antes («200 denied»).
 */
export const RESULT_CODES = [
  "allowed",
  "denied",
  "own_data_only",
  "no_sql_error",
  "no_data",
  "baseline_failed",
  "method_not_safe",
  "no_resources",
  "no_auth_required",
  "login_failed",
  "credential_expired",
  "error",
  "accepted",
  "rejected",
  "declared_only",
  "undeclared_fields",
  "hardened",
  "limited",
  "not_applicable",
  "not_created",
  "not_injectable",
  "not_jwt",
  "budget_reserved",
] as const;

export type ResultCode = (typeof RESULT_CODES)[number];

export const isResultCode = (part: string): part is ResultCode =>
  (RESULT_CODES as readonly string[]).includes(part);
