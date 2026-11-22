"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { AcceptRiskDialog } from "@/components/dialogs/accept-risk-dialog";
import { DetailSkeleton } from "@/components/skeletons/page-skeletons";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { HttpViewer } from "@/components/ui/http-viewer";
import { QueryState } from "@/components/ui/query-state";
import { SeverityMeter } from "@/components/ui/severity";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast";
import { ErrorPanel } from "@/features/errors/error-panel";
import { ProjectShell } from "@/features/projects/project-shell";
import { Link } from "@/i18n/navigation";
import {
  OPEN_STATUSES,
  type Evidence,
  type Finding,
  type FindingOccurrence,
} from "@/lib/api/schemas/findings";
import type { Project } from "@/lib/api/schemas/projects";
import { isUuid } from "@/lib/api/zod";
import { cn } from "@/lib/cn";
import { ApiError } from "@/lib/http";
import { useHttpClient } from "@/lib/http/browser";
import {
  dismissFinding,
  revertDismissal,
  useAfterFinding,
  useFinding,
  useOccurrences,
} from "./api";
import { badgeStatus } from "./finding-status";
import { MODULE_VIEW } from "./modules";

const card =
  "border-line bg-panel flex flex-col gap-3.5 rounded-[28px] border p-6 backdrop-blur-lg";

/** RF-66: ocurrencias de 10 en 10 (el contrato admite hasta 20). */
const OCCURRENCES_PAGE = 10;

/** Un CWE con la forma `CWE-<n>` enlaza a su ficha; cualquier otro valor se muestra como texto. */
const CWE = /^CWE-(\d{1,6})$/;

const headerLines = (headers: Record<string, string>) =>
  Object.entries(headers).map(([name, value]) => `${name}: ${value}`);

/** Petición y respuesta como texto. Vienen de la API del analista: nunca se interpretan (C-12). */
function evidenceText(evidence: Evidence) {
  const { request, response } = evidence;
  const req = [`${request.method} ${request.url}`, ...headerLines(request.headers)];
  if (request.body !== null) req.push("", request.body);
  const res = [`HTTP ${response.status_code}`, ...headerLines(response.headers), "", response.body];
  return { request: req.join("\n"), response: res.join("\n") };
}

/** Comando `curl` con la petición tal cual (las credenciales ya vienen enmascaradas, RN-11). */
function curlFor(evidence: Evidence) {
  const quote = (value: string) => `'${value.replaceAll("'", `'\\''`)}'`;
  const parts = [`curl -X ${evidence.request.method} ${quote(evidence.request.url)}`];
  for (const line of headerLines(evidence.request.headers)) parts.push(`-H ${quote(line)}`);
  if (evidence.request.body !== null) parts.push(`--data ${quote(evidence.request.body)}`);
  return parts.join(" \\\n  ");
}

/** `context.resource` de acceso a objetos (`type`, `value`, `owner`), si viene con esa forma. */
function resourceOf(context: Evidence["context"]) {
  const resource = context.resource;
  if (!resource || typeof resource !== "object") return null;
  const { type, value, owner } = resource as Record<string, unknown>;
  return typeof type === "string" && typeof value === "string"
    ? { type, value, owner: typeof owner === "string" ? owner : null }
    : null;
}

function EvidenceBlock({ occurrence }: { occurrence: FindingOccurrence }) {
  const t = useTranslations("FindingDetail");
  const text = evidenceText(occurrence.evidence);
  const response = occurrence.evidence.response;
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-4">
      <HttpViewer
        title={t("evidence.request")}
        note={t("evidence.masked")}
        content={text.request}
      />
      <HttpViewer
        title={t("evidence.response", { status: response.status_code })}
        note={response.body_truncated ? t("evidence.truncated") : undefined}
        content={text.response}
      />
    </div>
  );
}

function Occurrences({ project, finding }: { project: Project; finding: Finding }) {
  const t = useTranslations("FindingDetail");
  const ts = useTranslations("Severity");
  const format = useFormatter();
  const [page, setPage] = useState(1);
  const query = useOccurrences(project.id, finding.id, page, OCCURRENCES_PAGE);
  return (
    <section aria-labelledby="fd-occ" className={card}>
      <h2 id="fd-occ" className="text-lg font-semibold">
        {t("occurrences.title")}
      </h2>
      <QueryState query={query} subject={t("occurrences.subject")} skeleton={<DetailSkeleton />}>
        {(data) => {
          const pages = Math.max(1, Math.ceil(data.total / data.page_size));
          return (
            <>
              <ol className="stagger m-0 flex list-none flex-col gap-2.5 p-0">
                {data.items.map((o) => (
                  <li key={o.run.id} className="bg-panel-2 rounded-[18px] px-4 py-3">
                    <details>
                      <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3">
                        <span className="text-[15px] font-semibold">
                          {t("history.run", { number: o.run.number })}
                          <span className="text-muted font-normal">
                            {" · "}
                            {format.dateTime(new Date(o.detected_at), {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        </span>
                        <span className="flex items-center gap-2 text-[13px] font-bold">
                          <SeverityMeter severity={o.severity} />
                          {ts(o.severity)}
                        </span>
                      </summary>
                      <div className="mt-3 flex flex-col gap-3">
                        <p className="text-[15px] leading-[1.55]">{o.explanation}</p>
                        <EvidenceBlock occurrence={o} />
                        <Link
                          href={`/projects/${project.id}/runs/${o.run.id}`}
                          className="text-link self-start text-sm font-bold"
                        >
                          {t("occurrences.viewRun", { number: o.run.number })}
                        </Link>
                      </div>
                    </details>
                  </li>
                ))}
              </ol>
              {pages > 1 ? (
                <div className="flex items-center justify-between gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page <= 1 || query.isFetching}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    {t("previous")}
                  </Button>
                  <span className="text-muted text-[13px]">{t("page", { page, pages })}</span>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page >= pages || query.isFetching}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    {t("next")}
                  </Button>
                </div>
              ) : null}
            </>
          );
        }}
      </QueryState>
    </section>
  );
}

function FindingDetail({ project, finding }: { project: Project; finding: Finding }) {
  const t = useTranslations("FindingDetail");
  const tm = useTranslations("Dashboard.modules");
  const ts = useTranslations("Severity");
  const format = useFormatter();
  const toast = useToast();
  const http = useHttpClient();
  const afterFinding = useAfterFinding(project.id);
  const [accepting, setAccepting] = useState(false);
  const [reverting, setReverting] = useState(false);

  const occurrence = finding.last_occurrence;
  const open = (OPEN_STATUSES as readonly string[]).includes(finding.status);
  const cwe = finding.cwe ? CWE.exec(finding.cwe) : null;
  const resource = resourceOf(occurrence.evidence.context);
  const date = (iso: string) =>
    format.dateTime(new Date(iso), { day: "numeric", month: "short", year: "numeric" });

  async function revert() {
    if (reverting) return;
    setReverting(true);
    try {
      await revertDismissal(http, project.id, finding.id);
      toast.show({ type: "success", title: t("reverted") });
    } catch (error) {
      toast.show({
        type: "error",
        ...(error instanceof ApiError && error.code === "finding.not_dismissed"
          ? { title: t("errors.notDismissed") }
          : error instanceof ApiError && error.requestId
            ? { title: t("errors.revert"), text: t("errors.reference", { id: error.requestId }) }
            : { title: t("errors.revert") }),
      });
    } finally {
      // En los dos casos el detalle se vuelve a pedir: el estado pudo cambiar en otra pestaña.
      afterFinding();
      setReverting(false);
    }
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
          <StatusBadge kind="finding" status={badgeStatus(finding.status)} />
        </div>
        <dl className="stagger m-0 grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-x-6 gap-y-4">
          {[
            [
              t("fields.operation"),
              <span key="o" className="font-mono text-[14px] break-all">
                {finding.operation
                  ? `${finding.operation.method} ${finding.operation.path}`
                  : t("globalOperation")}
              </span>,
            ],
            [
              t("fields.identity"),
              finding.identity.deleted
                ? t("identityDeleted", { name: finding.identity.name })
                : finding.identity.name,
            ],
            [t("fields.module"), tm(`names.${MODULE_VIEW[finding.module].key}`)],
            [
              t("fields.owasp"),
              <span key="w" className="font-mono">
                {finding.owasp_category}
              </span>,
            ],
            [
              t("fields.cwe"),
              cwe ? (
                <a
                  key="c"
                  href={`https://cwe.mitre.org/data/definitions/${cwe[1]}.html`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-link font-mono font-semibold"
                >
                  {finding.cwe}
                  <span className="sr-only"> {t("newTab")}</span>
                </a>
              ) : (
                <span key="c" className="font-mono">
                  {finding.cwe ?? "—"}
                </span>
              ),
            ],
            [
              t("fields.detected"),
              t("detectedRuns", {
                first: finding.first_run.number,
                last: finding.last_run.number,
              }),
            ],
          ].map(([label, value]) => (
            <div key={String(label)} className="flex flex-col gap-1">
              <dt className="text-muted text-[13px]">{label}</dt>
              <dd className="m-0 text-[15px] font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
        {/* TODO(api): no hay operación para volver a probar un solo hallazgo. */}
        {open ? (
          <Button
            size="lg"
            className="self-start"
            onClick={() => setAccepting(true)}
            aria-haspopup="dialog"
          >
            {t("acceptRisk")}
          </Button>
        ) : null}
      </section>

      {finding.dismissal ? (
        <Banner
          tone="info"
          icon="shield"
          title={t(
            finding.dismissal.reason === "false_positive"
              ? "accepted.falsePositive"
              : "accepted.accepted",
          )}
          action={
            <Button
              variant="secondary"
              size="sm"
              loading={reverting}
              disabled={reverting}
              onClick={() => void revert()}
            >
              {t("revert")}
            </Button>
          }
        >
          <span className="block whitespace-pre-line">{finding.dismissal.justification}</span>
          <span className="text-muted block">
            {t("accepted.note", { date: date(finding.dismissal.dismissed_at) })}
          </span>
        </Banner>
      ) : null}

      {finding.status === "resolved" && finding.resolution_reason ? (
        <Banner tone="info" icon="check" title={t(`resolved.${finding.resolution_reason}`)}>
          {finding.resolved_at ? t("resolved.at", { date: date(finding.resolved_at) }) : null}
        </Banner>
      ) : null}

      <section aria-labelledby="fd-why" className={cn(card, "border-danger/45 bg-danger-bg")}>
        <h2 id="fd-why" className="text-muted text-sm font-semibold">
          {t("why.title", { identity: finding.identity.name })}
        </h2>
        <p className="max-w-[72ch] text-[15px] leading-[1.6]">{occurrence.explanation}</p>
        {resource ? (
          <span className="text-muted text-sm">
            {resource.owner
              ? t("why.resourceOwner", { ...resource, owner: resource.owner })
              : t("why.resource", { type: resource.type, value: resource.value })}
          </span>
        ) : null}
      </section>

      <section aria-labelledby="fd-evidence" className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="fd-evidence" className="text-lg font-semibold">
            {t("evidence.title", { run: occurrence.run.number })}
          </h2>
          <CopyButton
            value={curlFor(occurrence.evidence)}
            label={t("evidence.copyCurl")}
            size="sm"
          />
        </div>
        <EvidenceBlock occurrence={occurrence} />
      </section>

      <div className="flex flex-wrap items-start gap-5">
        <section aria-labelledby="fd-fix" className={cn(card, "min-w-[280px] flex-[1_1_380px]")}>
          <h2 id="fd-fix" className="text-lg font-semibold">
            {t("fix.title")}
          </h2>
          <p className="text-muted max-w-[68ch] text-[15px] leading-[1.6]">
            {finding.recommendation}
          </p>
        </section>
        <section
          aria-labelledby="fd-history"
          className={cn(card, "min-w-[280px] flex-[1_1_320px]")}
        >
          <h2 id="fd-history" className="text-lg font-semibold">
            {t("history.title")}
          </h2>
          <ol className="stagger m-0 flex list-none flex-col gap-2.5 p-0">
            {finding.history.map((h, i) => (
              <li
                key={`${h.occurred_at}-${i}`}
                className="bg-panel-2 flex flex-wrap items-center justify-between gap-3 rounded-[18px] px-4 py-3"
              >
                <span className="flex flex-col gap-0.5">
                  <span className="text-[15px] font-semibold">
                    {h.run ? t("history.run", { number: h.run.number }) : t("history.analyst")}
                    <span className="text-muted font-normal">
                      {" · "}
                      {date(h.occurred_at)}
                    </span>
                  </span>
                  <span className="text-muted text-[13px]">{t(`history.reason.${h.reason}`)}</span>
                  {h.justification ? (
                    <span className="text-[13px] whitespace-pre-line">{h.justification}</span>
                  ) : null}
                </span>
                <StatusBadge kind="finding" status={badgeStatus(h.to_status)} />
              </li>
            ))}
          </ol>
        </section>
      </div>

      <Occurrences project={project} finding={finding} />

      <AcceptRiskDialog
        open={accepting}
        onOpenChange={setAccepting}
        mapError={(error) => {
          if (error instanceof ApiError && error.code === "finding.not_open") {
            afterFinding();
            return { title: t("errors.notOpen") };
          }
          if (error instanceof ApiError && error.fieldCode("justification"))
            return { title: t("errors.justification") };
          return error instanceof ApiError && error.requestId
            ? { title: t("errors.dismiss"), text: t("errors.reference", { id: error.requestId }) }
            : { title: t("errors.dismiss") };
        }}
        onSubmit={async ({ reason, justification }) => {
          const updated = await dismissFinding(http, project.id, finding.id, {
            reason,
            justification,
          });
          afterFinding(updated);
          toast.show({
            type: "success",
            title: t(reason === "false_positive" ? "toast.falsePositive" : "toast.accepted"),
          });
        }}
      />
    </>
  );
}

function FindingLoader({ project, findingId }: { project: Project; findingId: string }) {
  const t = useTranslations("FindingDetail");
  const query = useFinding(project.id, findingId);
  return (
    <QueryState query={query} subject={t("subject")} skeleton={<DetailSkeleton />}>
      {(finding) => <FindingDetail key={finding.id} project={project} finding={finding} />}
    </QueryState>
  );
}

/** V-30. Detalle de un hallazgo: por qué es una falla, evidencia, corrección e historial (RF-66 a RF-72). */
export function FindingDetailView({ id, findingId }: { id: string; findingId: string }) {
  const t = useTranslations("FindingDetail");
  const tf = useTranslations("Findings");
  const valid = isUuid(id) && isUuid(findingId);
  const finding = useFinding(id, findingId, valid).data;
  return (
    <ProjectShell
      id={id}
      trail={[{ label: tf("title"), href: `/projects/${id}/findings` }, { label: t("crumb") }]}
      title={finding?.title ?? t("crumb")}
      render={(project) =>
        valid ? (
          <FindingLoader key={findingId} project={project} findingId={findingId} />
        ) : (
          <ErrorPanel code={404} standalone={false} href={`/projects/${id}/findings`} />
        )
      }
    />
  );
}
