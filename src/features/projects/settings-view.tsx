"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import { DeleteDialog } from "@/components/dialogs/delete-dialog";
import { ApiWarnings } from "@/components/ui/api-warnings";
import { UnsavedChangesGuard } from "@/components/dialogs/unsaved-changes-guard";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { inputClass, TextField } from "@/components/ui/text-field";
import { useToast } from "@/components/ui/toast";
import { useRouter } from "@/i18n/navigation";
import { projectUpdateSchema, type Project, type ProjectUpdate } from "@/lib/api/schemas/projects";
import { fieldErrors } from "@/lib/api/zod";
import { cn } from "@/lib/cn";
import { ApiError, type ApiWarning } from "@/lib/http";
import { useHttpClient } from "@/lib/http/browser";
import { checkBaseUrl } from "@/lib/url";
import { deleteProject, updateProject, useRefreshProjects } from "./api";
import { ProjectShell } from "./project-shell";
import { deleteErrorMessage } from "./projects-view";

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

const MAX_NAME = 100;
const MAX_DESCRIPTION = 500;

function Settings({ project }: { project: Project }) {
  const t = useTranslations("ProjectSettings");
  const tp = useTranslations("Projects");
  const router = useRouter();
  const toast = useToast();
  const http = useHttpClient();
  const refresh = useRefreshProjects();
  const original = {
    name: project.name,
    description: project.description ?? "",
    baseUrl: project.base_url,
  };
  const [name, setName] = useState(original.name);
  const [description, setDescription] = useState(original.description);
  const [baseUrl, setBaseUrl] = useState(original.baseUrl);
  const [errors, setErrors] = useState<{ name?: string; description?: string; url?: string }>({});
  const [dialog, setDialog] = useState<"host" | "delete" | null>(null);
  const [warnings, setWarnings] = useState<ApiWarning[]>([]);
  const [pending, setPending] = useState(false);
  const verified = project.verification_status === "verified";

  const check = checkBaseUrl(baseUrl);
  const hostChanged = check.ok && hostOf(baseUrl.trim()) !== project.host;
  const dirty =
    name !== original.name || description !== original.description || baseUrl !== original.baseUrl;
  const insecure = check.ok && check.insecure;

  function fieldMessage(field: "name" | "description" | "url", code: string | undefined) {
    if (!code) return undefined;
    if (field === "url") {
      if (code === "validation.required") return t("errors.urlRequired");
      if (code === "url.scheme_not_allowed") return t("errors.url.protocol");
      if (code === "url.destination_not_allowed") return t("errors.url.destination");
      return t("errors.url.invalid");
    }
    if (field === "name") {
      return code === "validation.required" ? t("errors.nameRequired") : t("errors.nameInvalid");
    }
    return t("errors.descriptionInvalid");
  }

  /** Solo se envían los campos que cambiaron (PATCH). */
  function changes(): ProjectUpdate | null {
    const patch: Record<string, unknown> = {};
    if (name !== original.name) patch.name = name;
    if (description !== original.description) patch.description = description;
    if (baseUrl !== original.baseUrl) patch.base_url = baseUrl;
    const parsed = projectUpdateSchema.safeParse(patch);
    const local = parsed.success ? {} : fieldErrors(parsed.error);
    const next = {
      name: fieldMessage("name", local.name?.[0]),
      description: fieldMessage("description", local.description?.[0]),
      url: fieldMessage("url", local.base_url?.[0]),
    };
    if (!next.url && baseUrl !== original.baseUrl && !check.ok) {
      next.url = t(`errors.url.${check.problem}`);
    }
    setErrors(next);
    return parsed.success && !next.name && !next.description && !next.url ? parsed.data : null;
  }

  /** Guarda; si falla, lanza el error para que el diálogo que lo pidió lo muestre. */
  async function save(patch: ProjectUpdate) {
    try {
      const result = await updateProject(http, project.id, patch);
      setWarnings(result.data.warnings);
      refresh.setProject(result.data);
      await refresh.projects();
      toast.show({ type: "success", title: t("saved") });
    } catch (e) {
      if (e instanceof ApiError && e.kind === "validation" && e.fields) {
        setErrors({
          name: fieldMessage("name", e.fieldCode("name")),
          description: fieldMessage("description", e.fieldCode("description")),
          url: fieldMessage("url", e.fieldCode("base_url")),
        });
      }
      throw e;
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const patch = changes();
    if (!patch) return;
    // Cambiar el host exacto pierde la verificación: se pide confirmarlo antes de guardar.
    if (hostChanged && verified) {
      setDialog("host");
      return;
    }
    setPending(true);
    try {
      await save(patch);
    } catch (e) {
      if (!(e instanceof ApiError && e.kind === "validation")) {
        toast.show({
          type: "error",
          title: t("errors.saveTitle"),
          text:
            e instanceof ApiError && e.status === 429
              ? t("errors.rateLimited")
              : e instanceof ApiError && e.requestId
                ? t("errors.reference", { id: e.requestId })
                : t("errors.saveText"),
        });
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <UnsavedChangesGuard dirty={dirty && dialog === null} />
      <ApiWarnings warnings={warnings.length > 0 ? warnings : project.warnings} />

      <form
        noValidate
        onSubmit={onSubmit}
        className="border-line bg-panel flex max-w-[860px] flex-col gap-[22px] rounded-[28px] border p-6 backdrop-blur-lg sm:p-8"
      >
        <h2 className="font-display text-[28px] font-medium tracking-[-0.02em]">{t("title")}</h2>
        <TextField
          label={t("name")}
          value={name}
          maxLength={MAX_NAME}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
          labelAside={
            <span className="text-muted text-[13px] tabular-nums">
              {name.length} / {MAX_NAME}
            </span>
          }
        />
        <div className="flex flex-col gap-2">
          <div className="flex justify-between gap-3">
            <label htmlFor="settings-description" className="text-sm font-semibold">
              {t("description")} <span className="text-muted font-normal">{t("optional")}</span>
            </label>
            <span className="text-muted text-[13px] tabular-nums">
              {description.length} / {MAX_DESCRIPTION}
            </span>
          </div>
          <textarea
            id="settings-description"
            rows={3}
            maxLength={MAX_DESCRIPTION}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            aria-invalid={errors.description ? true : undefined}
            aria-describedby={errors.description ? "settings-description-error" : undefined}
            className={cn(inputClass, "py-3.5 leading-[1.5]")}
          />
          {errors.description ? (
            <p id="settings-description-error" role="alert" className="text-danger text-sm">
              {errors.description}
            </p>
          ) : null}
        </div>
        <TextField
          label={t("url")}
          type="url"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          error={errors.url}
          hint={
            baseUrl !== original.baseUrl ? (
              <>
                {t("before")} <code className="font-mono">{original.baseUrl}</code>
              </>
            ) : (
              t("urlHint")
            )
          }
          className={cn("font-mono text-[15px]", insecure && "border-warning")}
        />
        {hostChanged && verified ? (
          <div
            role="note"
            className="border-line bg-panel-2 border-l-warning flex items-start gap-3 rounded-[18px] border border-l-4 px-4 py-3.5"
          >
            <Icon name="alert" className="text-warning" />
            <div className="flex flex-col gap-1">
              <b className="text-sm">{t("hostChanged.title")}</b>
              <span className="text-muted text-sm leading-[1.5]">{t("hostChanged.text")}</span>
            </div>
          </div>
        ) : null}
        <div className="border-line flex flex-wrap justify-end gap-3 border-t pt-1.5">
          <Button
            variant="secondary"
            disabled={!dirty}
            onClick={() => {
              setName(original.name);
              setDescription(original.description);
              setBaseUrl(original.baseUrl);
              setErrors({});
            }}
          >
            {t("discard")}
          </Button>
          <Button type="submit" disabled={!dirty} loading={pending}>
            {t("save")}
          </Button>
        </div>
      </form>

      <section
        aria-labelledby="settings-delete"
        className="border-line bg-panel flex max-w-[860px] flex-col gap-3.5 rounded-[28px] border p-6 backdrop-blur-lg"
      >
        <h2 id="settings-delete" className="text-lg font-semibold">
          {t("delete.title")}
        </h2>
        <p className="text-muted text-sm">{t("delete.lead")}</p>
        <ul className="text-muted m-0 flex list-disc flex-col gap-1 pl-[18px] text-sm">
          {/* TODO(api): `Project` no trae cuántas versiones, identidades o recursos hay. */}
          <li>{t("delete.contractAll")}</li>
          <li>{t("delete.identitiesAll")}</li>
          <li>{t("delete.runs", { findings: project.open_findings_by_severity.total })}</li>
        </ul>
        <div>
          <Button variant="danger" onClick={() => setDialog("delete")}>
            {t("delete.button")}
          </Button>
        </div>
      </section>

      <ConfirmDialog
        open={dialog === "host"}
        onOpenChange={(open) => setDialog(open ? "host" : null)}
        title={t("hostDialog.title")}
        description={t("hostDialog.text")}
        confirmLabel={t("hostDialog.confirm")}
        mapError={(e) => ({
          title: t("errors.saveTitle"),
          text:
            e instanceof ApiError && e.kind === "validation"
              ? t("errors.checkFields")
              : e instanceof ApiError && e.requestId
                ? t("errors.reference", { id: e.requestId })
                : t("errors.saveText"),
        })}
        onConfirm={async () => {
          const patch = changes();
          if (patch) await save(patch);
        }}
      />
      <DeleteDialog
        open={dialog === "delete"}
        onOpenChange={(open) => setDialog(open ? "delete" : null)}
        title={t("deleteDialog.title", { name: project.name })}
        description={t("deleteDialog.description")}
        confirmText={project.name}
        consequences={{
          heading: t("deleteDialog.removed"),
          items: [t("deleteDialog.removed1"), t("deleteDialog.removed2")],
        }}
        confirmLabel={t("delete.button")}
        mapError={(e) => deleteErrorMessage(e, tp)}
        onConfirm={async () => {
          await deleteProject(http, project.id, project.name);
          refresh.removeProject(project.id);
          await refresh.projects();
          toast.show({ type: "success", title: t("deleted", { name: project.name }) });
          router.push("/projects");
        }}
      />
    </div>
  );
}

/** V-17. Ajustes del proyecto (`updateProject`, `deleteProject`), con el aviso de cambio de host. */
export function SettingsView({ id }: { id: string }) {
  const t = useTranslations("ProjectSettings");
  return (
    <ProjectShell
      id={id}
      section={t("crumb")}
      title={t("pageTitle")}
      render={(project) => <Settings key={project.updated_at} project={project} />}
    />
  );
}
