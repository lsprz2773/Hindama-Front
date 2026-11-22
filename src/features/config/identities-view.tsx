"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import { Button, ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { TablePageSkeleton } from "@/components/skeletons/page-skeletons";
import { QueryState } from "@/components/ui/query-state";
import { useToast } from "@/components/ui/toast";
import type { Identity } from "@/lib/api/schemas/identities";
import type { Project } from "@/lib/api/schemas/projects";
import { cn } from "@/lib/cn";
import { identityStatusFromApi } from "@/lib/contract/identities";
import { ApiError } from "@/lib/http";
import { useHttpClient } from "@/lib/http/browser";
import { ProjectShell } from "@/features/projects/project-shell";
import { deleteIdentity, testIdentity, useAfterIdentities, useIdentities } from "./api";

type UiStatus = "active" | "expiredCredential" | "untested";

const STATUS_DOT: Record<UiStatus, string> = {
  active: "bg-success",
  expiredCredential: "bg-danger",
  untested: "bg-info",
};

/** Error de una acción sobre una identidad → texto (los códigos los da la API). */
function actionError(error: unknown, t: ReturnType<typeof useTranslations<"Identities">>) {
  if (error instanceof ApiError) {
    if (error.code === "project.not_verified") return { title: t("errors.notVerified") };
    if (error.code === "project.active_run") return { title: t("errors.activeRun") };
    if (error.code === "identity.no_test_operation") return { title: t("errors.noTestOperation") };
    if (error.status === 429) return { title: t("errors.rateLimited") };
    if (error.requestId)
      return { title: t("errors.failed"), text: t("errors.reference", { id: error.requestId }) };
  }
  return { title: t("errors.failed") };
}

function Identities({ project, identities }: { project: Project; identities: Identity[] }) {
  const t = useTranslations("Identities");
  const format = useFormatter();
  const toast = useToast();
  const http = useHttpClient();
  const afterChange = useAfterIdentities(project.id);
  const [toDelete, setToDelete] = useState<Identity | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const base = `/projects/${project.id}/identities`;

  // Lo que falta lo informa la API en `Project.modules[].missing`.
  const missing = (module: string, reason: string) =>
    project.modules.some((m) => m.module === module && m.missing.includes(reason as never));
  const requirements = [
    { key: "objects", ok: !missing("object_access", "insufficient_identities") },
    { key: "functions", ok: !missing("function_access", "no_admin_identity") },
  ] as const;

  async function test(identity: Identity) {
    if (testing) return;
    setTesting(identity.id);
    try {
      const result = await testIdentity(http, project.id, identity.id);
      afterChange();
      if (result.succeeded) {
        toast.show({
          type: "success",
          title: t("test.okTitle", { name: identity.name }),
          text: t("test.okText", { code: result.status_code ?? "—", path: result.operation.path }),
        });
      } else {
        toast.show({
          type: "error",
          title: t("test.failedTitle", { name: identity.name }),
          text: t(`test.failure.${result.failure ?? "rejected"}`, {
            code: result.status_code ?? "—",
          }),
        });
      }
    } catch (error) {
      toast.show({ type: "error", ...actionError(error, t) });
    } finally {
      setTesting(null);
    }
  }

  return (
    <>
      <p className="text-muted -mt-2 max-w-[80ch] text-[15px] leading-[1.55]">{t("lead")}</p>

      <section
        aria-labelledby="identities-requirements"
        className="border-line flex flex-col gap-3.5 rounded-[28px] border bg-[image:var(--hero)] p-6"
      >
        <h2 id="identities-requirements" className="text-lg font-semibold">
          {t("requirements.title")}
        </h2>
        <ul className="stagger m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-3 p-0">
          {requirements.map((r) => (
            <li
              key={r.key}
              className="border-line bg-panel-2 flex items-start gap-3 rounded-[20px] border p-4"
            >
              <Icon
                name={r.ok ? "check" : "alert"}
                strokeWidth={2.4}
                className={r.ok ? "text-success" : "text-warning"}
              />
              <span className="flex flex-col gap-0.5">
                <b className="text-[15px]">{t(`requirements.${r.key}.title`)}</b>
                <span className="text-muted text-[13.5px] leading-[1.45]">
                  {t(`requirements.${r.key}.${r.ok ? "ok" : "missing"}`)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="identities-list"
        className="border-line bg-panel flex flex-col gap-2.5 rounded-[28px] border p-6 backdrop-blur-lg"
      >
        <h2 id="identities-list" className="text-lg font-semibold">
          {t("count", { count: identities.length })}
        </h2>
        <ul className="stagger m-0 flex list-none flex-col gap-2 p-0">
          {identities.map((identity) => {
            const fixed = identity.auth_type === "none";
            const status = identityStatusFromApi(identity.status, identity.last_tested_at);
            return (
              <li
                key={identity.id}
                className="border-line bg-panel-2 grid items-center gap-x-3.5 gap-y-2 rounded-[20px] border px-4 py-3.5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1.4fr)_110px_minmax(0,1.4fr)_100px_auto]"
              >
                <span className="flex min-w-0 flex-col gap-0.5">
                  <b className="text-[15px] break-words">{identity.name}</b>
                  <span className="text-muted text-[13px]">
                    {fixed
                      ? t("roles.anonymous")
                      : identity.role_label
                        ? t("roles.named", {
                            role: t(`roles.${identity.role}`),
                            name: identity.role_label,
                          })
                        : t(`roles.${identity.role}`)}
                  </span>
                </span>
                <span className="text-sm">{t(`auth.${identity.auth_type}`)}</span>
                <code className="text-muted font-mono text-[13.5px]">
                  {identity.credential_suffix ? `••••${identity.credential_suffix}` : "—"}
                </code>
                <span className="flex items-center gap-2 text-sm">
                  <span
                    aria-hidden="true"
                    className={cn("size-2 flex-none rounded-full", STATUS_DOT[status])}
                  />
                  {t(`status.${status}`)}
                  {identity.last_test_status_code !== null && status !== "untested"
                    ? ` · ${identity.last_test_status_code}`
                    : null}
                  {status === "active" && identity.last_tested_at
                    ? ` · ${t("tested", { time: format.relativeTime(new Date(identity.last_tested_at)) })}`
                    : null}
                </span>
                <span
                  className={cn(
                    "text-sm font-semibold",
                    fixed ? "text-muted" : identity.resource_count === 0 ? "text-warning" : "",
                  )}
                >
                  {fixed
                    ? "—"
                    : identity.resource_count === 0
                      ? t("noResources")
                      : identity.resource_count}
                </span>
                <span className="flex items-center justify-end gap-1.5">
                  {fixed ? (
                    <span className="text-muted text-[13px]">{t("alwaysExists")}</span>
                  ) : (
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="min-h-10 rounded-xl px-3 text-sm"
                        onClick={() => void test(identity)}
                        loading={testing === identity.id}
                        disabled={testing !== null || project.verification_status !== "verified"}
                        title={
                          project.verification_status !== "verified"
                            ? t("errors.notVerified")
                            : undefined
                        }
                      >
                        {t("test.button")}
                      </Button>
                      <ButtonLink
                        href={`${base}/${identity.id}`}
                        variant="secondary"
                        size="sm"
                        className="min-h-10 rounded-xl px-3 text-sm"
                      >
                        {t("edit")}
                      </ButtonLink>
                      <button
                        type="button"
                        aria-label={t("delete.label", { name: identity.name })}
                        onClick={() => setToDelete(identity)}
                        className="border-line text-danger inline-flex size-10 cursor-pointer items-center justify-center rounded-xl border"
                      >
                        <Icon name="x" size={16} />
                      </button>
                    </>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="text-muted mx-0.5 mt-1 text-[13.5px] leading-[1.5]">{t("deleteNote")}</p>
      </section>

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={t("delete.title", { name: toDelete?.name ?? "" })}
        description={t("delete.text")}
        consequences={{
          heading: t("delete.heading"),
          items: [t("delete.item1"), t("delete.item2")],
        }}
        confirmLabel={t("delete.confirm")}
        danger
        mapError={(error) => actionError(error, t)}
        onConfirm={async () => {
          if (!toDelete) return;
          await deleteIdentity(http, project.id, toDelete.id);
          afterChange();
          toast.show({ type: "success", title: t("delete.done", { name: toDelete.name }) });
        }}
      />
    </>
  );
}

/** V-21. Identidades de prueba del proyecto: lo que necesita cada módulo y la lista editable (RF-28 a RF-34). */
export function IdentitiesView({ id }: { id: string }) {
  const t = useTranslations("Identities");
  return (
    <ProjectShell
      id={id}
      section={t("crumb")}
      title={t("title")}
      actions={
        <ButtonLink href={`/projects/${id}/identities/new`}>
          <Icon name="plus" size={18} strokeWidth={2.4} />
          {t("add")}
        </ButtonLink>
      }
      render={(project) => <IdentitiesLoader project={project} />}
    />
  );
}

function IdentitiesLoader({ project }: { project: Project }) {
  const t = useTranslations("Identities");
  const query = useIdentities(project.id);
  return (
    <QueryState query={query} subject={t("subject")} skeleton={<TablePageSkeleton />}>
      {(data) => <Identities project={project} identities={data.items} />}
    </QueryState>
  );
}
