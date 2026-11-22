"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { EmptyState } from "@/components/ui/state-view";
import { MethodBadge } from "@/components/ui/method-badge";
import { ErrorPanel } from "@/features/errors/error-panel";
import { ProjectShell } from "@/features/projects/project-shell";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { MATRIX_IDENTITIES, SAMPLE_MATRIX, type CellKind } from "./data";
import { RunTabs } from "./run-tabs";
import { runSummaryFor } from "./report-view";

const MARK: Record<CellKind, string> = {
  allow: "✓",
  deny: "×",
  discrepancy: "!",
  error: "?",
  na: "–",
  expired: "–",
};

/** Estilo de cada tipo de celda: el color refuerza, el símbolo y el texto siempre están (daltonismo). */
const CELL_STYLE: Record<CellKind, string> = {
  allow: "border-line text-success",
  deny: "border-line text-muted",
  discrepancy: "border-danger border-2 text-danger",
  error: "border-warning border-2 border-dotted text-warning",
  na: "border-line border-dashed bg-transparent text-muted",
  expired: "border-line-strong border-dashed bg-transparent text-muted",
};

function Switch({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className="border-line bg-panel-2 text-fg inline-flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl border px-4 text-sm font-semibold"
    >
      <span
        aria-hidden="true"
        className={cn(
          "relative inline-block h-[22px] w-10 rounded-full transition-colors",
          checked ? "bg-accent" : "bg-line-strong",
        )}
      >
        <span
          className={cn(
            "absolute top-[3px] size-4 rounded-full bg-white transition-[left]",
            checked ? "left-[21px]" : "left-[3px]",
          )}
        />
      </span>
      {children}
    </button>
  );
}

function Matrix({ base, run }: { base: string; run: number }) {
  const t = useTranslations("Matrix");
  const [onlyDiscrepancies, setOnlyDiscrepancies] = useState(false);

  const discrepancyCount = SAMPLE_MATRIX.reduce(
    (n, row) => n + row.cells.filter((c) => c.kind === "discrepancy").length,
    0,
  );
  const rows = onlyDiscrepancies
    ? SAMPLE_MATRIX.filter((row) => row.cells.some((c) => c.kind === "discrepancy"))
    : SAMPLE_MATRIX;

  const legend: { kind: CellKind; text: string }[] = [
    { kind: "allow", text: t("legend.allow") },
    { kind: "deny", text: t("legend.deny") },
    { kind: "discrepancy", text: t("legend.discrepancy") },
    { kind: "error", text: t("legend.error") },
    { kind: "na", text: t("legend.skipped") },
  ];

  function cellText(kind: CellKind, code?: string): [string, string] {
    const shown = code === "cors" ? t("cors") : code === "timeout" ? t("timeout") : (code ?? "");
    switch (kind) {
      case "allow":
        return [shown, t("expected.allow")];
      case "deny":
        return [shown, t("expected.deny")];
      case "discrepancy":
        return [`${shown} · ${t("discrepancy")}`, t("expected.deny")];
      case "error":
        return [t("error"), shown];
      case "na":
        return [t("notApplicable"), t("usesAnonymous")];
      default:
        return [t("notTested"), t("expiredCredential")];
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <RunTabs base={base} run={String(run)} active="matrix" findings={15} />
        <Switch checked={onlyDiscrepancies} onChange={() => setOnlyDiscrepancies((v) => !v)}>
          {t("onlyDiscrepancies")}
        </Switch>
      </div>

      <section
        aria-labelledby="ley-h"
        className="border-line bg-panel flex flex-wrap items-center gap-3 rounded-[24px] border px-5 py-4 backdrop-blur-lg"
      >
        <h2 id="ley-h" className="text-muted text-sm font-semibold">
          {t("legend.title")}
        </h2>
        {legend.map((l) => (
          <span
            key={l.kind}
            className={cn(
              "bg-panel-2 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[13px]",
              CELL_STYLE[l.kind],
            )}
          >
            <b aria-hidden="true" className="font-mono">
              {MARK[l.kind]}
            </b>
            <span className="text-fg">{l.text}</span>
          </span>
        ))}
      </section>

      <section
        aria-labelledby="mx-h"
        className="border-line bg-panel flex flex-col gap-4 rounded-[28px] border p-6 backdrop-blur-lg"
      >
        <h2 id="mx-h" className="text-lg font-semibold">
          {t("summary", {
            rows: rows.length,
            identities: MATRIX_IDENTITIES.length,
            discrepancies: discrepancyCount,
          })}
        </h2>
        {rows.length === 0 ? (
          <EmptyState positive title={t("none.title")} text={t("none.text")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-separate border-spacing-2 text-left">
              <caption className="sr-only">{t("caption")}</caption>
              <thead>
                <tr>
                  <th scope="col" className="text-muted px-3 py-2 text-[13px] font-bold">
                    {t("operation")}
                  </th>
                  {MATRIX_IDENTITIES.map((identity) => (
                    <th key={identity.name} scope="col" className="px-3 py-2 text-sm font-semibold">
                      <b className="block">{identity.name}</b>
                      <span className="text-muted text-[12.5px] font-normal">
                        {t(`roles.${identity.role}`)}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.method}${row.path}`}>
                    <th
                      scope="row"
                      className="bg-panel-2 rounded-[16px] px-3 py-3 align-top font-normal"
                    >
                      <span className="flex flex-wrap items-center gap-2">
                        {row.method ? <MethodBadge method={row.method} /> : null}
                        <code className="font-mono text-[13px] break-all">
                          {row.method ? row.path : t("global")}
                          {row.ownedBy ? ` ${t("ownedBy", { name: row.ownedBy })}` : ""}
                        </code>
                      </span>
                      <span className="text-muted mt-1.5 block text-[12.5px]">
                        {t(`templates.${row.template}`)}
                      </span>
                    </th>
                    {row.cells.map((cell, j) => {
                      const [line1, line2] = cellText(cell.kind, cell.code);
                      const identity = MATRIX_IDENTITIES[j].name;
                      const label = `${identity}: ${line1}, ${line2.toLowerCase()}`;
                      const content = (
                        <>
                          <span className="flex items-center gap-2 text-sm font-semibold">
                            <b aria-hidden="true" className="font-mono text-base">
                              {MARK[cell.kind]}
                            </b>
                            {line1}
                          </span>
                          <span className="text-muted text-[12.5px]">{line2}</span>
                        </>
                      );
                      const style = cn(
                        "bg-panel-2 flex min-h-[64px] flex-col justify-center gap-0.5 rounded-[16px] border px-3 py-2 text-fg no-underline",
                        CELL_STYLE[cell.kind],
                      );
                      return (
                        <td key={identity} className="p-0 align-top">
                          {cell.finding ? (
                            <Link
                              href={`${base}/findings/${cell.finding}`}
                              aria-label={label}
                              className={style}
                            >
                              {content}
                            </Link>
                          ) : (
                            <div role="group" aria-label={label} className={style}>
                              {content}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

/** V-28. Matriz de acceso: cada operación frente a cada identidad, con las discrepancias a la vista (RF-61 a RF-63). */
export function MatrixView({ id, runId }: { id: string; runId: string }) {
  const t = useTranslations("Matrix");
  const tr = useTranslations("RunResults");
  return (
    <ProjectShell
      id={id}
      trail={[
        { label: tr("crumbHistory"), href: `/projects/${id}/history` },
        { label: tr("title", { number: runId }), href: `/projects/${id}/runs/${runId}` },
      ]}
      title={t("title")}
    >
      {(project) => {
        const run = runSummaryFor(project, runId);
        if (!run) return <ErrorPanel code={404} standalone={false} href={`/projects/${id}`} />;
        if (project.id !== "pedidos")
          return <EmptyState title={t("empty.title")} text={t("empty.text")} />;
        return <Matrix key={`${project.id}-${runId}`} base={`/projects/${id}`} run={run.number} />;
      }}
    </ProjectShell>
  );
}
