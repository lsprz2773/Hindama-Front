"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import { DeleteDialog } from "@/components/dialogs/delete-dialog";
import { ApiWarnings } from "@/components/ui/api-warnings";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { inputClass, TextField } from "@/components/ui/text-field";
import { useToast } from "@/components/ui/toast";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { checkBaseUrl } from "@/lib/url";
import { ProjectShell } from "./project-shell";
import { deleteProject, hostOf, updateProject, type Project } from "./store";

const MAX_NAME = 100;
const MAX_DESCRIPTION = 500;

function Settings({ project }: { project: Project }) {
  const t = useTranslations("ProjectSettings");
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [baseUrl, setBaseUrl] = useState(project.baseUrl);
  const [errors, setErrors] = useState<{ name?: string; url?: string }>({});
  const [dialog, setDialog] = useState<"host" | "delete" | null>(null);
  const [lostVerification, setLostVerification] = useState(false);

  const check = checkBaseUrl(baseUrl);
  const hostChanged = check.ok && hostOf(baseUrl) !== hostOf(project.baseUrl);
  const dirty =
    name !== project.name || description !== project.description || baseUrl !== project.baseUrl;
  const insecure = check.ok && check.insecure;

  function validate() {
    const next: typeof errors = {};
    if (!name.trim()) next.name = t("errors.nameRequired");
    if (!baseUrl.trim()) next.url = t("errors.urlRequired");
    else if (!check.ok) next.url = t(`errors.url.${check.problem}`);
    setErrors(next);
    return !next.name && !next.url;
  }

  function save() {
    updateProject(project.id, {
      name: name.trim(),
      description: description.trim(),
      baseUrl: baseUrl.trim(),
      ...(hostChanged ? { verified: false } : {}),
    });
    setLostVerification(hostChanged && project.verified);
    toast.show({ type: "success", title: t("saved") });
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!validate()) return;
    // Cambiar el host exacto pierde la verificación: se pide confirmarlo antes de guardar.
    if (hostChanged && project.verified) setDialog("host");
    else save();
  }

  return (
    <div className="flex flex-col gap-5">
      {lostVerification ? <ApiWarnings warnings={[{ code: "project.verification_lost" }]} /> : null}
      {insecure ? <ApiWarnings warnings={[{ code: "url.no_tls" }]} /> : null}

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
            className={cn(inputClass, "py-3.5 leading-[1.5]")}
          />
        </div>
        <TextField
          label={t("url")}
          type="url"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          error={errors.url}
          hint={
            baseUrl !== project.baseUrl ? (
              <>
                {t("before")} <code className="font-mono">{project.baseUrl}</code>
              </>
            ) : (
              t("urlHint")
            )
          }
          className={cn("font-mono text-[15px]", insecure && "border-warning")}
        />
        {hostChanged && project.verified ? (
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
              setName(project.name);
              setDescription(project.description);
              setBaseUrl(project.baseUrl);
              setErrors({});
            }}
          >
            {t("discard")}
          </Button>
          <Button type="submit" disabled={!dirty}>
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
          <li>{t("delete.contract", { versions: 3 })}</li>
          <li>{t("delete.identities", { count: project.identities })}</li>
          <li>{t("delete.resources", { count: project.resources })}</li>
          <li>{t("delete.runs", { findings: project.openFindings ?? 0 })}</li>
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
        onConfirm={async () => save()}
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
        onConfirm={async () => {
          await new Promise((resolve) => setTimeout(resolve, 400)); // TODO(api)
          deleteProject(project.id);
          toast.show({ type: "success", title: t("deleted", { name: project.name }) });
          router.push("/projects");
        }}
      />
    </div>
  );
}

/** V-17. Ajustes del proyecto: editar datos (con el aviso de cambio de host) y eliminarlo. */
export function SettingsView({ id }: { id: string }) {
  const t = useTranslations("ProjectSettings");
  return (
    <ProjectShell id={id} section={t("crumb")} title={t("pageTitle")}>
      {(project) => <Settings key={project.id} project={project} />}
    </ProjectShell>
  );
}
