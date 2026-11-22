"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { AcceptRiskDialog } from "@/components/dialogs/accept-risk-dialog";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { HttpViewer } from "@/components/ui/http-viewer";
import { Icon } from "@/components/ui/icon";
import { SeverityMeter } from "@/components/ui/severity";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast";
import { ErrorPanel } from "@/features/errors/error-panel";
import { ProjectShell } from "@/features/projects/project-shell";
import type { Project } from "@/features/projects/store";
import { cn } from "@/lib/cn";
import { evidenceFor, FINDING_EXTRA, historyFor, type Finding } from "./data";
import { isOpen, useFindings } from "./findings-store";

const card =
  "border-line bg-panel flex flex-col gap-3.5 rounded-[28px] border p-6 backdrop-blur-lg";
const FIXES = ["API1", "API2", "API3", "API4", "API5", "API8", "API9"] as const;
type FixKey = (typeof FIXES)[number];

function FindingDetail({ project, finding }: { project: Project; finding: Finding }) {
  const t = useTranslations("FindingDetail");
  const tm = useTranslations("Dashboard.modules");
  const ts = useTranslations("Severity");
  const format = useFormatter();
  const toast = useToast();
  const { update } = useFindings(project.id);
  const [accepting, setAccepting] = useState(false);

  const extra = FINDING_EXTRA[finding.id] ?? { policy: "authenticated" as const, observed: "200" };
  const evidence = evidenceFor(finding, project.baseUrl);
  const owasp = finding.owasp.split(":")[0];
  const fixKey: FixKey = (FIXES as readonly string[]).includes(owasp) ? (owasp as FixKey) : "API8";
  const run = project.report?.runNumber ?? 1;
  const accepted = finding.status === "acceptedRisk";
  const cweNumber = finding.cwe.replace("CWE-", "");
  const observedLabel =
    extra.observed === "200"
      ? "200 OK"
      : extra.observed === "404"
        ? t("observed.404")
        : t("observed.500");
  const history = historyFor(accepted ? (finding.before ?? "persistent") : finding.status);

  function revert() {
    const back = finding.before ?? "persistent";
    update(finding.id, {
      status: back,
      before: undefined,
      reason: undefined,
      justification: undefined,
    });
    toast.show({ type: "success", title: t("reverted", { status: t(`statusName.${back}`) }) });
  }

  return (
    <>
      <section
        aria-labelledby="fd-summary"
        className="border-line flex flex-col gap-5 rounded-[28px] border bg-[image:var(--hero)] p-6 sm:p-8"
      >
        <h2 id="fd-summary" className="sr-only">
          {t("summary")}
        </h2>
        <div className="flex flex-wrap items-center gap-3.5">
          <SeverityMeter severity={finding.severity} />
          <span className="text-sm font-bold">
            {t("severity", { severity: ts(finding.severity).toLowerCase() })}
          </span>
          <StatusBadge kind="finding" status={finding.status} />
        </div>
        <dl className="stagger m-0 grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-x-6 gap-y-4">
          {[
            [
              t("fields.operation"),
              <span key="o" className="font-mono text-[14px] break-all">
                {finding.method ? `${finding.method} ${finding.path}` : t("globalOperation")}
              </span>,
            ],
            [t("fields.identity"), finding.identity],
            [t("fields.module"), tm(`names.${finding.module}`)],
            [
              t("fields.owasp"),
              <span key="w" className="font-mono">
                {finding.owasp}
              </span>,
            ],
            [
              t("fields.cwe"),
              <a
                key="c"
                href={`https://cwe.mitre.org/data/definitions/${cweNumber}.html`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-link font-mono font-semibold"
              >
                {finding.cwe}
                <span className="sr-only"> {t("newTab")}</span>
              </a>,
            ],
          ].map(([label, value]) => (
            <div key={String(label)} className="flex flex-col gap-1">
              <dt className="text-muted text-[13px]">{label}</dt>
              <dd className="m-0 text-[15px] font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-wrap gap-3">
          <Button
            size="lg"
            variant="secondary"
            onClick={() =>
              toast.show({ type: "info", title: t("retestStarted"), text: t("retestText") })
            }
          >
            <Icon name="refresh" size={16} />
            {t("retest")}
          </Button>
          {isOpen(finding) ? (
            <Button size="lg" onClick={() => setAccepting(true)} aria-haspopup="dialog">
              {t("acceptRisk")}
            </Button>
          ) : null}
        </div>
      </section>

      {accepted ? (
        <Banner
          tone="info"
          icon="shield"
          title={t(
            finding.reason === "false_positive" ? "accepted.falsePositive" : "accepted.accepted",
          )}
          action={
            <Button variant="secondary" size="sm" onClick={revert}>
              {t("revert")}
            </Button>
          }
        >
          {finding.justification ? <span className="block">{finding.justification}</span> : null}
          <span className="text-muted block">
            {t("accepted.note", { status: t(`statusName.${finding.before ?? "persistent"}`) })}
          </span>
        </Banner>
      ) : null}

      <div className="flex flex-wrap gap-5">
        <section aria-labelledby="fd-expected" className={cn(card, "min-w-[280px] flex-1")}>
          <h2 id="fd-expected" className="text-muted text-sm font-semibold">
            {t("expected.title", { policy: t(`policies.${extra.policy}`) })}
          </h2>
          <span className="bg-track inline-flex self-start rounded-full px-3 py-1 text-[13px] font-bold">
            {extra.policy === "global" ? t("expected.secure") : t("expected.denied")}
          </span>
          <span className="text-[15px]">{t(`expected.text.${extra.policy}`)}</span>
        </section>
        <section
          aria-labelledby="fd-observed"
          className={cn(card, "border-danger/45 bg-danger-bg min-w-[280px] flex-1")}
        >
          <h2 id="fd-observed" className="text-muted text-sm font-semibold">
            {t("observed.title", { identity: finding.identity })}
          </h2>
          <span className="text-danger bg-panel-2 inline-flex self-start rounded-full px-3 py-1 text-[13px] font-bold">
            {observedLabel}
          </span>
          <span className="text-[15px]">{t(`observed.text.${extra.policy}`)}</span>
        </section>
      </div>

      <section aria-labelledby="fd-evidence" className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="fd-evidence" className="text-lg font-semibold">
            {t("evidence.title", { run })}
          </h2>
          <CopyButton value={evidence.curl} label={t("evidence.copyCurl")} size="sm" />
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-4">
          <HttpViewer
            title={t("evidence.request")}
            note={t("evidence.masked")}
            content={evidence.request}
          />
          <HttpViewer
            title={t("evidence.response", { status: observedLabel })}
            note={t("evidence.size", { bytes: 412 })}
            content={evidence.response}
          />
        </div>
      </section>

      <div className="flex flex-wrap items-start gap-5">
        <section aria-labelledby="fd-fix" className={cn(card, "min-w-[280px] flex-[1_1_380px]")}>
          <h2 id="fd-fix" className="text-lg font-semibold">
            {t("fix.title")}
          </h2>
          <p className="text-muted max-w-[68ch] text-[15px] leading-[1.6]">{t(`fix.${fixKey}`)}</p>
        </section>
        <section
          aria-labelledby="fd-history"
          className={cn(card, "min-w-[280px] flex-[1_1_320px]")}
        >
          <h2 id="fd-history" className="text-lg font-semibold">
            {t("history.title")}
          </h2>
          <ol className="stagger m-0 flex list-none flex-col gap-2.5 p-0">
            {history.map((h) => (
              <li
                key={h.run}
                className="bg-panel-2 flex flex-wrap items-center justify-between gap-3 rounded-[18px] px-4 py-3"
              >
                <span className="flex flex-col gap-0.5">
                  <span className="text-[15px] font-semibold">
                    {t("history.run", { number: h.run })}
                    <span className="text-muted font-normal">
                      {" · "}
                      {format.dateTime(new Date(`${h.date}T00:00:00Z`), {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        timeZone: "UTC",
                      })}
                    </span>
                  </span>
                  <span className="text-muted text-[13px]">
                    {t(`history.reason.${h.status}`, { number: h.run })}
                  </span>
                </span>
                <StatusBadge kind="finding" status={h.status} />
              </li>
            ))}
          </ol>
        </section>
      </div>

      <AcceptRiskDialog
        open={accepting}
        onOpenChange={setAccepting}
        onSubmit={async ({ reason, justification }) => {
          await new Promise((resolve) => setTimeout(resolve, 500)); // TODO(api): aceptar el riesgo
          update(finding.id, {
            status: "acceptedRisk",
            before: finding.status,
            reason,
            justification,
          });
          toast.show({
            type: "success",
            title: t(reason === "false_positive" ? "toast.falsePositive" : "toast.accepted"),
          });
        }}
      />
    </>
  );
}

/** V-30. Detalle de un hallazgo: esperado frente a observado, evidencia, corrección e historial (RF-66 a RF-70). */
export function FindingDetailView({ id, findingId }: { id: string; findingId: string }) {
  const t = useTranslations("FindingDetail");
  const tf = useTranslations("Findings");
  const { findings } = useFindings(id);
  const finding = findings.find((f) => f.id === findingId);
  return (
    <ProjectShell
      id={id}
      trail={[{ label: tf("title"), href: `/projects/${id}/findings` }, { label: t("crumb") }]}
      title={finding?.title ?? t("notFound")}
    >
      {(project) =>
        finding ? (
          <FindingDetail key={finding.id} project={project} finding={finding} />
        ) : (
          <ErrorPanel code={404} standalone={false} href={`/projects/${id}/findings`} />
        )
      }
    </ProjectShell>
  );
}
