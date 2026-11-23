"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { PendingResources } from "@/components/ui/pending-resources";
import { useOperations } from "@/features/config/api";
import type { CreatedResourceFailure } from "@/lib/api/schemas/runs";

/** `status_NNN`: el código HTTP del último intento de borrar el recurso. */
const STATUS = /^status_(\d{3})$/;
const KNOWN = [
  "no_answer",
  "no_identifier",
  "budget_exhausted",
  "not_deleted",
  "run_interrupted",
] as const;

/**
 * C-15 con el detalle de `created_resources.failed_items` (contrato 0.10.0): la operación, la ruta
 * y por qué no se borró cada recurso que el analista debe eliminar a mano (CU-23 E1, RN-06). Lo que
 * dice cada motivo sale del contrato; uno que el frontend no conoce se muestra como genérico.
 */
export function FailedResources({
  projectId,
  items,
}: {
  projectId: string;
  items: CreatedResourceFailure[];
}) {
  const t = useTranslations("FailedResources");
  const operations = useOperations(projectId, { includeRetired: true, enabled: items.length > 0 });
  const names = useMemo(
    () => new Map(operations.data?.items.map((op) => [op.id, `${op.method} ${op.path}`])),
    [operations.data],
  );
  if (items.length === 0) return null;

  const reason = (code: string | null) => {
    const status = code ? STATUS.exec(code) : null;
    if (status) return t("errors.status", { status: status[1] });
    return (KNOWN as readonly string[]).includes(code ?? "")
      ? t(`errors.${code as (typeof KNOWN)[number]}`)
      : t("errors.unknown");
  };

  return (
    <PendingResources
      resources={items.map((item) => ({
        operation: names.get(item.operation_id) ?? t("operationUnknown"),
        location: item.location,
        lastError: reason(item.last_error),
      }))}
    />
  );
}
