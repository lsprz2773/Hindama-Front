"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { useRouter } from "@/i18n/navigation";
import type { Project } from "@/lib/api/schemas/projects";
import type { Schemas } from "@/lib/api/types";
import { ApiError } from "@/lib/http";
import { useHttpClient } from "@/lib/http/browser";
import { rerunRun, useAfterRun } from "./api";
import { MODULE_VIEW } from "./modules";

type Translate = ReturnType<typeof useTranslations<"Rerun">>;

function rerunError(error: unknown, t: Translate) {
  if (error instanceof ApiError) {
    if (error.code === "project.active_run") return { title: t("errors.activeRun") };
    if (error.code === "project.not_verified") return { title: t("errors.notVerified") };
    if (error.code === "run.module_unavailable") return { title: t("errors.moduleUnavailable") };
    if (error.status === 429) return { title: t("errors.rateLimited") };
    if (error.requestId)
      return { title: t("errors.failed"), text: t("errors.reference", { id: error.requestId }) };
  }
  return { title: t("errors.failed") };
}

interface RerunButtonProps {
  project: Project;
  run: { id: string; number: number; modules: Schemas["Module"][] };
  label: string;
  size?: "sm" | "md" | "lg";
  variant?: "primary" | "secondary";
}

/**
 * `rerunRun` (RF-71): repite una ejecución terminada con sus módulos y límites. Si incluye un
 * módulo de riesgo medio o alto, pide confirmarlo otra vez: la de la original no vale (RN-05).
 */
export function RerunButton({ project, run, label, size = "lg", variant }: RerunButtonProps) {
  const t = useTranslations("Rerun");
  const tm = useTranslations("Dashboard.modules");
  const http = useHttpClient();
  const toast = useToast();
  const router = useRouter();
  const afterRun = useAfterRun(project.id);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const risky = run.modules.filter(
    (m) => (project.modules.find((x) => x.module === m)?.risk ?? "low") !== "low",
  );

  async function send(confirmRisk: boolean) {
    const created = await rerunRun(
      http,
      project.id,
      run.id,
      confirmRisk ? { confirm_risk: true } : {},
    );
    afterRun(created);
    toast.show({ type: "info", title: t("started", { number: created.number }) });
    router.push(`/projects/${project.id}/runs/current`);
  }

  async function click() {
    if (busy) return;
    if (risky.length > 0) return setConfirming(true);
    setBusy(true);
    try {
      await send(false);
    } catch (error) {
      if (error instanceof ApiError && error.code === "run.module_unavailable") afterRun();
      toast.show({ type: "error", ...rerunError(error, t) });
      setBusy(false);
    }
  }

  return (
    <>
      <Button size={size} variant={variant} loading={busy} onClick={() => void click()}>
        <Icon name="play" size={16} />
        {label}
      </Button>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t("confirm.title", { number: run.number })}
        description={t("confirm.text")}
        consequences={{
          heading: t("confirm.heading"),
          items: risky.map((m) => tm(`names.${MODULE_VIEW[m].key}`)),
        }}
        confirmLabel={t("confirm.button")}
        mapError={(error) => rerunError(error, t)}
        onConfirm={() => send(true)}
      />
    </>
  );
}
