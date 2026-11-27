"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { DetailSkeleton } from "@/components/skeletons/page-skeletons";
import { ApiWarnings } from "@/components/ui/api-warnings";
import { Button, ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { MethodBadge } from "@/components/ui/method-badge";
import { QueryState } from "@/components/ui/query-state";
import { EmptyState } from "@/components/ui/state-view";
import { TextField } from "@/components/ui/text-field";
import { useToast } from "@/components/ui/toast";
import { Link } from "@/i18n/navigation";
import {
  contractFileError,
  contractUrlSchema,
  type ContractVersion,
  type Operation,
} from "@/lib/api/schemas/contracts";
import type { Project } from "@/lib/api/schemas/projects";
import type { Schemas } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { ApiError, type ApiWarning } from "@/lib/http";
import { useHttpClient } from "@/lib/http/browser";
import { ProjectShell } from "@/features/projects/project-shell";
import { importContract, useAfterImport, useContract, useOperations } from "./api";

const METHODS = ["all", "GET", "POST", "PUT", "PATCH", "DELETE"] as const;
const PAGE_SIZE = 100;
const card = "border-line bg-panel flex flex-col gap-4 rounded-[28px] border p-6 backdrop-blur-lg";

type Source = "file" | "url";
type Method = (typeof METHODS)[number];

/** Código de error de la importación (o de su campo) → clave de texto. */
const IMPORT_ERRORS: Record<string, string> = {
  "validation.required": "noFile",
  "contract.invalid_type": "type",
  "contract.too_large": "size",
  "request.too_large": "size",
  "url.invalid_format": "url",
  "url.scheme_not_allowed": "url",
  "validation.format": "url",
  "validation.length": "url",
  "contract.source_required": "noFile",
  "contract.invalid": "invalid",
  "contract.unsupported_version": "unsupported",
  "contract.url_unreachable": "unreachable",
  "contract.url_not_allowed": "notAllowed",
};

function securityLabel(op: Operation, t: ReturnType<typeof useTranslations<"Contract">>) {
  if (op.security.length === 0) return t("operations.security.public");
  return op.security.map((s) => s.scheme).join(", ");
}

function CurrentVersion({ version }: { version: ContractVersion }) {
  const t = useTranslations("Contract");
  const format = useFormatter();
  const summary = [
    [version.openapi_version, t("summary.openapi")],
    [format.number(version.operation_count), t("summary.operations")],
    [`v${version.number}`, t("summary.version")],
  ];
  return (
    <section
      aria-labelledby="contract-version"
      className="border-line flex min-w-0 flex-[999_1_480px] flex-col gap-[18px] rounded-[28px] border bg-[image:var(--hero)] p-6 sm:p-8"
    >
      <span className="border-line bg-panel-2 inline-flex items-center gap-2 self-start rounded-full border px-3 py-1.5 text-[13px] font-semibold">
        <Icon name="check" size={14} strokeWidth={2.4} className="text-success" />
        {t("current", {
          date: format.dateTime(new Date(version.imported_at), {
            dateStyle: "medium",
            timeZone: "UTC",
          }),
        })}
      </span>
      <div className="flex flex-col gap-1.5">
        {/* `api_title` y el nombre del archivo vienen del documento: solo texto. */}
        <h2
          id="contract-version"
          className="font-display text-[32px] font-medium tracking-[-0.025em] break-words"
        >
          {version.api_title ?? t("untitled")}
        </h2>
        <code className="font-mono text-sm break-all">
          {version.source === "file" ? version.file_name : version.source_url}
        </code>
        <span className="text-muted text-[13.5px]">
          {t("meta", {
            format: version.format.toUpperCase(),
            source: t(`source.${version.source}`),
            openapi: version.openapi_version,
            hash: `${version.sha256.slice(0, 4)}…${version.sha256.slice(-4)}`,
          })}
        </span>
      </div>
      <dl className="stagger m-0 grid grid-cols-[repeat(auto-fit,minmax(110px,1fr))] gap-3">
        {summary.map(([value, label]) => (
          <div
            key={label}
            className="border-line bg-panel-2 flex flex-col gap-1 rounded-[20px] border px-4 py-3.5"
          >
            <dt className="text-muted order-2 text-[13px]">{label}</dt>
            <dd className="font-display order-1 m-0 text-[28px] leading-none font-medium tabular-nums">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function ImportPanel({ project, versions }: { project: Project; versions: number }) {
  const t = useTranslations("Contract");
  const toast = useToast();
  const http = useHttpClient();
  const afterImport = useAfterImport(project.id);
  const [source, setSource] = useState<Source>("file");
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string>();
  const [problems, setProblems] = useState<{ location: string; code: string }[]>([]);
  const [warnings, setWarnings] = useState<ApiWarning[]>([]);
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const base = `/projects/${project.id}`;

  const message = (code: string | undefined) =>
    t(`errors.${(code && IMPORT_ERRORS[code]) || "failed"}` as never);

  function pick(next: File | undefined) {
    setError(undefined);
    if (!next) return setFile(null);
    const code = contractFileError(next);
    if (code) {
      setFile(null);
      return setError(message(code));
    }
    setFile(next);
  }

  async function submit() {
    if (importing) return;
    setError(undefined);
    setProblems([]);
    setWarnings([]);
    if (source === "file" && !file) return setError(t("errors.noFile"));
    if (source === "url") {
      const parsed = contractUrlSchema.safeParse(url);
      if (!parsed.success) return setError(t("errors.url"));
    }
    setImporting(true);
    try {
      const result = await importContract(
        http,
        project.id,
        source === "file" && file ? { file } : { url },
      );
      afterImport();
      setWarnings(result.data.warnings);
      setFile(null);
      setUrl("");
      if (result.status === 200) {
        toast.show({ type: "info", title: t("unchanged") });
      } else {
        toast.show({
          type: "success",
          title: t("imported"),
          text: result.data.warnings.length > 0 ? t("importedText") : t("importedTextClean"),
        });
      }
    } catch (e) {
      if (!(e instanceof ApiError)) throw e;
      if (e.status === 429) return setError(t("errors.rateLimited"));
      if (e.code === "contract.invalid") {
        // `field` es la ubicación en el documento (JSON Pointer o «línea N»): texto no confiable.
        setProblems(
          Object.entries(e.fields).flatMap(([location, codes]) =>
            codes.map((code) => ({ location, code })),
          ),
        );
      }
      const code =
        e.code === "validation.failed" ? (e.fieldCode("file") ?? e.fieldCode("url")) : e.code;
      setError(
        e.status >= 500 && e.requestId
          ? `${message(undefined)} ${t("errors.reference", { id: e.requestId })}`
          : message(e.status === 413 ? "contract.too_large" : code),
      );
    } finally {
      setImporting(false);
    }
  }

  return (
    <section
      aria-labelledby="contract-import"
      className={cn(card, "min-w-[300px] flex-[1_1_360px]")}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="contract-import" className="text-lg font-semibold">
          {t("import.title")}
        </h2>
        {versions > 0 ? (
          <Link href={`${base}/contract/versions`} className="text-link text-sm font-bold">
            {t("import.versions", { count: versions })}
          </Link>
        ) : null}
      </div>
      <div
        role="tablist"
        aria-label={t("import.sourceLabel")}
        className="border-line bg-panel-2 flex gap-1.5 self-start rounded-2xl border p-1.5"
      >
        {(["file", "url"] as const).map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={source === s}
            onClick={() => {
              setSource(s);
              setError(undefined);
            }}
            className={cn(
              "min-h-10 cursor-pointer rounded-xl px-4 text-sm font-semibold",
              source === s ? "bg-accent text-on-accent" : "text-fg",
            )}
          >
            {t(`import.${s}`)}
          </button>
        ))}
      </div>

      {source === "file" ? (
        <label
          htmlFor="contract-file"
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            pick(e.dataTransfer.files[0]);
          }}
          className={cn(
            "border-line-strong flex cursor-pointer flex-col items-center gap-2 rounded-[22px] border-2 border-dashed px-4 py-7 text-center",
            dragging && "border-accent bg-selected",
          )}
        >
          <span
            aria-hidden="true"
            className="bg-progress-bg text-accent inline-flex size-12 items-center justify-center rounded-2xl"
          >
            <Icon name="file" size={24} />
          </span>
          <b className="text-[15px] break-all">{file ? file.name : t("import.drop")}</b>
          <span className="text-muted text-[13px]">
            {file ? `${(file.size / 1024).toFixed(1)} KB` : t("import.limits")}
          </span>
          <input
            id="contract-file"
            type="file"
            accept=".json,.yaml,.yml"
            className="sr-only"
            onChange={(e) => pick(e.target.files?.[0])}
          />
        </label>
      ) : (
        <TextField
          label={t("import.urlLabel")}
          type="url"
          placeholder="https://api.ejemplo.mx/openapi.yaml"
          value={url}
          maxLength={2048}
          onChange={(e) => setUrl(e.target.value)}
          hint={t("import.urlHint")}
        />
      )}

      {error ? (
        <p role="alert" className="flex items-start gap-2 text-[13.5px]">
          <Icon name="alertCircle" size={16} className="text-danger mt-0.5" />
          {error}
        </p>
      ) : null}
      {problems.length > 0 ? (
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-[13px]">
          {problems.slice(0, 20).map((p, i) => (
            <li key={`${p.location}:${i}`} className="flex flex-wrap gap-2">
              <code className="font-mono break-all">{p.location}</code>
              <span className="text-muted">{p.code}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <Button onClick={() => void submit()} loading={importing} disabled={importing}>
        {importing ? t("import.importing") : t("import.submit")}
      </Button>
      <ApiWarnings warnings={warnings} />
    </section>
  );
}

function Operations({ project }: { project: Project }) {
  const t = useTranslations("Contract");
  const [method, setMethod] = useState<Method>("all");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const query = useOperations(project.id, {
    page,
    pageSize: PAGE_SIZE,
    method: method === "all" ? undefined : (method as Schemas["HttpMethod"]),
  });
  const base = `/projects/${project.id}`;

  return (
    <section aria-labelledby="contract-ops" className={cn(card, "gap-5 p-6 sm:p-8")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="contract-ops" className="text-lg font-semibold">
          {t("operations.title", { count: query.data?.total ?? 0 })}
        </h2>
        <div
          role="group"
          aria-label={t("operations.filterLabel")}
          className="flex flex-wrap gap-1.5"
        >
          {METHODS.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={method === m}
              onClick={() => {
                setMethod(m);
                setPage(1);
              }}
              className={cn(
                "min-h-9 cursor-pointer rounded-full px-3.5 text-[13px] font-semibold",
                method === m ? "bg-accent text-on-accent" : "border-line bg-panel-2 border",
              )}
            >
              {m === "all" ? t("operations.all") : m}
            </button>
          ))}
        </div>
      </div>

      <QueryState query={query} subject={t("operations.subject")} skeleton={<DetailSkeleton />}>
        {(data) => {
          const pages = Math.max(1, Math.ceil(data.total / data.page_size));
          return (
            <>
              <ul className="stagger m-0 flex list-none flex-col gap-1.5 p-0">
                {data.items.map((o) => {
                  const expanded = open === o.id;
                  return (
                    <li
                      key={o.id}
                      className={cn(
                        "rounded-[18px] border",
                        expanded ? "border-line bg-panel-2" : "border-transparent",
                      )}
                    >
                      <div className="flex flex-wrap items-center gap-3 px-3.5 py-2.5">
                        <MethodBadge method={o.method} />
                        <code className="font-mono text-sm break-all">{o.path}</code>
                        <span className="text-muted min-w-[160px] flex-1 text-sm">{o.summary}</span>
                        <span className="text-muted text-[13px]">
                          {t("operations.paramCount", { count: o.parameters.length })}
                        </span>
                        <span className="text-[13px]">{securityLabel(o, t)}</span>
                        <button
                          type="button"
                          aria-expanded={expanded}
                          aria-label={t("operations.detail", { method: o.method, path: o.path })}
                          onClick={() => setOpen(expanded ? null : o.id)}
                          className="border-line text-fg inline-flex size-9 cursor-pointer items-center justify-center rounded-xl border"
                        >
                          <Icon name={expanded ? "chevronUp" : "chevronDown"} size={16} />
                        </button>
                      </div>
                      {expanded ? (
                        <div className="border-line grid gap-4 border-t px-4 py-4 sm:grid-cols-3">
                          <div className="flex flex-col gap-2">
                            <b className="text-sm">{t("operations.params")}</b>
                            {o.parameters.length === 0 ? (
                              <span className="text-muted text-[13px]">
                                {t("operations.noParams")}
                              </span>
                            ) : (
                              o.parameters.map((p) => (
                                <div key={`${p.location}:${p.name}`} className="text-[13px]">
                                  <code className="font-mono break-all">{p.name}</code>{" "}
                                  <span className="text-muted">
                                    {t("operations.param", {
                                      location: t(`operations.location.${p.location}`),
                                      type: p.type ?? "—",
                                      required: p.required ? "yes" : "no",
                                    })}
                                  </span>
                                </div>
                              ))
                            )}
                          </div>
                          <div className="flex flex-col gap-2">
                            <b className="text-sm">{t("operations.body")}</b>
                            <span className="text-muted text-[13px] break-all">
                              {o.body ? o.body.content_types.join(", ") : t("operations.noBody")}
                            </span>
                          </div>
                          <div className="flex flex-col gap-2">
                            <b className="text-sm">{t("operations.declaredSecurity")}</b>
                            {o.security.length === 0 ? (
                              <span className="text-muted text-[13px]">
                                {t("operations.security.public")}
                              </span>
                            ) : (
                              o.security.map((s) => (
                                <code key={s.scheme} className="font-mono text-[13px] break-all">
                                  {s.scheme} ({t(`operations.securityType.${s.type}`)})
                                </code>
                              ))
                            )}
                            <Link
                              href={`${base}/policy`}
                              className="text-link text-[13px] font-bold"
                            >
                              {t("operations.seePolicy")}
                            </Link>
                          </div>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
                {data.items.length === 0 ? (
                  <li className="text-muted px-3 py-6 text-center text-sm">
                    {t("operations.none")}
                  </li>
                ) : null}
              </ul>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-muted text-[13px]">
                  {t("operations.showing", { shown: data.items.length, total: data.total })}
                </span>
                {pages > 1 ? (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={page <= 1 || query.isFetching}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      {t("operations.previous")}
                    </Button>
                    <span className="text-muted text-[13px]">
                      {t("operations.page", { page, pages })}
                    </span>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={page >= pages || query.isFetching}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      {t("operations.next")}
                    </Button>
                  </div>
                ) : null}
              </div>
            </>
          );
        }}
      </QueryState>
    </section>
  );
}

function Contract({ project }: { project: Project }) {
  const t = useTranslations("Contract");
  const current = project.current_contract;
  const version = useContract(project.id, current?.id);
  const base = `/projects/${project.id}`;

  return (
    <>
      <div className="flex flex-wrap items-start gap-5">
        {current ? (
          <div className="flex min-w-0 flex-[999_1_480px] flex-col">
            <QueryState query={version} subject={t("subject")} skeleton={<DetailSkeleton />}>
              {(data) => <CurrentVersion version={data} />}
            </QueryState>
          </div>
        ) : (
          <div className="min-w-0 flex-[999_1_480px]">
            <EmptyState title={t("empty.title")} text={t("empty.text")} />
          </div>
        )}
        <ImportPanel project={project} versions={current?.number ?? 0} />
      </div>

      {current && version.data && version.data.warnings.length > 0 ? (
        <section aria-labelledby="contract-warnings" className="flex flex-col gap-3">
          <h2 id="contract-warnings" className="text-lg font-semibold">
            {t("warnings", { count: version.data.warnings.length })}
          </h2>
          <ApiWarnings warnings={version.data.warnings} />
        </section>
      ) : null}

      {current ? <Operations project={project} /> : null}

      {!current && project.verification_status !== "verified" ? (
        <ButtonLink
          href={`${base}/verification`}
          variant="ghost"
          size="sm"
          className="self-start px-0"
        >
          {t("next")}
        </ButtonLink>
      ) : null}
    </>
  );
}

/** V-19. Contrato OpenAPI: importar (archivo o URL), revisar avisos y explorar las operaciones. */
export function ContractView({ id }: { id: string }) {
  const t = useTranslations("Contract");
  return (
    <ProjectShell
      id={id}
      section={t("crumb")}
      title={t("title")}
      actions={
        <ButtonLink href={`/projects/${id}/contract/versions`} variant="secondary">
          <Icon name="clock" size={16} />
          {t("history")}
        </ButtonLink>
      }
      render={(project) => <Contract key={project.id} project={project} />}
    />
  );
}
