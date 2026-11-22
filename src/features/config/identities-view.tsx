"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import { Button, ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { ProjectShell } from "@/features/projects/project-shell";
import type { Project } from "@/features/projects/store";
import type { Identity } from "./data";
import { useIdentities } from "./identities";

const STATUS_DOT: Record<Identity["status"], string> = {
  active: "bg-success",
  expiredCredential: "bg-danger",
  untested: "bg-info",
};

function Identities({ project }: { project: Project }) {
  const t = useTranslations("Identities");
  const toast = useToast();
  const { identities, remove } = useIdentities(project.id);
  const [toDelete, setToDelete] = useState<Identity | null>(null);
  const base = `/projects/${project.id}/identities`;

  const named = identities.filter((i) => !i.fixed);
  const normal = named.filter((i) => i.role === "user" && i.resources > 0).length;
  const withAdmin = named.some((i) => i.role === "admin");
  const requirements = [
    { key: "objects", ok: normal >= 2 },
    { key: "functions", ok: withAdmin && named.some((i) => i.role === "user") },
  ] as const;

  function test(identity: Identity) {
    if (identity.status === "expiredCredential") {
      toast.show({
        type: "error",
        title: t("test.failedTitle", { name: identity.name }),
        text: t("test.failedText"),
      });
    } else {
      toast.show({ type: "success", title: t("test.okTitle", { name: identity.name }) });
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
          {identities.map((identity) => (
            <li
              key={identity.id}
              className="border-line bg-panel-2 grid items-center gap-x-3.5 gap-y-2 rounded-[20px] border px-4 py-3.5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1.4fr)_110px_minmax(0,1.4fr)_100px_auto]"
            >
              <span className="flex min-w-0 flex-col gap-0.5">
                <b className="text-[15px]">{identity.name}</b>
                <span className="text-muted text-[13px]">
                  {identity.roleNote
                    ? identity.role === "other" && identity.id !== "anonima"
                      ? t("roles.otherNamed", { name: identity.roleNote })
                      : identity.roleNote
                    : t(`roles.${identity.role}`)}
                </span>
              </span>
              <span className="text-sm">{t(`auth.${identity.auth}`)}</span>
              <code className="text-muted font-mono text-[13.5px]">
                {identity.last4 ? `••••${identity.last4}` : "—"}
              </code>
              <span className="flex items-center gap-2 text-sm">
                <span
                  aria-hidden="true"
                  className={cn("size-2 flex-none rounded-full", STATUS_DOT[identity.status])}
                />
                {t(`status.${identity.status}`)}
                {identity.status === "active" && identity.testedAgo
                  ? ` · ${t("testedAgo", { time: identity.testedAgo })}`
                  : null}
              </span>
              <span
                className={cn(
                  "text-sm font-semibold",
                  identity.fixed ? "text-muted" : identity.resources === 0 ? "text-warning" : "",
                )}
              >
                {identity.fixed
                  ? "—"
                  : identity.resources === 0
                    ? t("noResources")
                    : identity.resources}
              </span>
              <span className="flex items-center justify-end gap-1.5">
                {identity.fixed ? (
                  <span className="text-muted text-[13px]">{t("alwaysExists")}</span>
                ) : (
                  <>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="min-h-10 rounded-xl px-3 text-sm"
                      onClick={() => test(identity)}
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
          ))}
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
        onConfirm={async () => {
          if (!toDelete) return;
          await new Promise((resolve) => setTimeout(resolve, 300));
          remove(toDelete.id);
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
    >
      {(project) => <Identities key={project.id} project={project} />}
    </ProjectShell>
  );
}
