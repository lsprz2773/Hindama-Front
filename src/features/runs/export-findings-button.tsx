"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { ApiError } from "@/lib/http";
import { useHttpClient } from "@/lib/http/browser";
import { exportFindings, type FindingFilters } from "./api";

type Filters = Pick<FindingFilters, "module" | "severity" | "status" | "runId">;

/** Guarda un archivo descargado con un enlace temporal (no hay ruta del navegador que lo abra). */
function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * «Exportar a Excel» (RF-77, V-27, V-29 y V-32). Descarga los hallazgos que dejan los filtros dados;
 * el libro no incluye evidencia ni credenciales.
 */
export function ExportFindingsButton({
  projectId,
  filters = {},
  variant = "secondary",
}: {
  projectId: string;
  filters?: Filters;
  variant?: "primary" | "secondary";
}) {
  const t = useTranslations("ExportFindings");
  const http = useHttpClient();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const blob = await exportFindings(http, projectId, filters);
      saveBlob(blob, `hallazgos-${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.show({ type: "success", title: t("done") });
    } catch (error) {
      if (error instanceof ApiError && error.code === "finding.export_too_large") {
        toast.show({ type: "warning", title: t("tooLarge"), text: t("tooLargeText") });
      } else if (error instanceof ApiError && error.status === 429) {
        toast.show({ type: "warning", title: t("rateLimited") });
      } else {
        toast.show({
          type: "error",
          title: t("failed"),
          text:
            error instanceof ApiError && error.requestId
              ? t("reference", { id: error.requestId })
              : undefined,
        });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant={variant} onClick={run} disabled={busy} aria-busy={busy}>
      <Icon name="download" size={18} />
      {busy ? t("busy") : t("button")}
    </Button>
  );
}
