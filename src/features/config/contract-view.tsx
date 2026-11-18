"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { ApiWarnings } from "@/components/ui/api-warnings";
import { Button, ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { MethodBadge } from "@/components/ui/method-badge";
import { EmptyState } from "@/components/ui/state-view";
import { inputClass, TextField } from "@/components/ui/text-field";
import { useToast } from "@/components/ui/toast";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { ProjectShell } from "@/features/projects/project-shell";
import { updateProject, type Project } from "@/features/projects/store";
import { SAMPLE_OPERATIONS } from "./data";

const MAX_BYTES = 5 * 1024 * 1024;
const METHODS = ["all", "GET", "POST", "PUT", "PATCH", "DELETE"] as const;
const card = "border-line bg-panel flex flex-col gap-4 rounded-[28px] border p-6 backdrop-blur-lg";

type Source = "file" | "url";

function Contract({ project }: { project: Project }) {
  const t = useTranslations("Contract");
  const format = useFormatter();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<Source>("file");
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string>();
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(project.contractOps !== null);
  const [method, setMethod] = useState<(typeof METHODS)[number]>("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  const base = `/projects/${project.id}`;

  function pick(next: File | undefined) {
    setError(undefined);
    if (!next) return setFile(null);
    if (!/\.(json|ya?ml)$/i.test(next.name)) {
      setFile(null);
      return setError(t("errors.type"));
    }
    if (next.size > MAX_BYTES) {
      setFile(null);
      return setError(t("errors.size"));
    }
    setFile(next);
  }

  async function importContract() {
    setError(undefined);
    if (source === "file" && !file) return setError(t("errors.noFile"));
    if (source === "url") {
      try {
        new URL(url);
      } catch {
        return setError(t("errors.url"));
      }
    }
    setImporting(true);
    await new Promise((resolve) => setTimeout(resolve, 800)); // TODO(api): importar y analizar
    setImporting(false);
    updateProject(project.id, { contractOps: 42 });
    setImported(true);
    toast.show({ type: "success", title: t("imported"), text: t("importedText") });
  }

  const operations = SAMPLE_OPERATIONS.filter(
    (o) =>
      (method === "all" || o.method === method) &&
      (!query.trim() ||
        `${o.path} ${o.summary}`.toLowerCase().includes(query.trim().toLowerCase())),
  );

  const summary = [
    ["3.1", t("summary.openapi")],
    ["42", t("summary.operations")],
    ["14", t("summary.schemas")],
    ["1", t("summary.security")],
  ];

  return (
    <>
      <div className="flex flex-wrap items-start gap-5">
        {imported ? (
          <section
            aria-labelledby="contract-version"
            className="border-line flex min-w-0 flex-[999_1_480px] flex-col gap-[18px] rounded-[28px] border bg-[image:var(--hero)] p-6 sm:p-8"
          >
            <span className="border-line bg-panel-2 inline-flex items-center gap-2 self-start rounded-full border px-3 py-1.5 text-[13px] font-semibold">
              <Icon name="check" size={14} strokeWidth={2.4} className="text-success" />
              {t("current", {
                date: format.dateTime(new Date("2026-10-21"), {
                  dateStyle: "medium",
                  timeZone: "UTC",
                }),
              })}
            </span>
            <div className="flex flex-col gap-1.5">
              <h2
                id="contract-version"
                className="font-display text-[32px] font-medium tracking-[-0.025em]"
              >
                Pedidos API v2.4.0
              </h2>
              <code className="font-mono text-sm">pedidos-v2.4.yaml · 312 KB</code>
              <span className="text-muted text-[13.5px]">{t("meta")}</span>
            </div>
            <dl className="m-0 grid grid-cols-[repeat(auto-fit,minmax(110px,1fr))] gap-3">
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
        ) : (
          <div className="min-w-0 flex-[999_1_480px]">
            <EmptyState title={t("empty.title")} text={t("empty.text")} />
          </div>
        )}

        <section
          aria-labelledby="contract-import"
          className={cn(card, "min-w-[300px] flex-[1_1_360px]")}
        >
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="contract-import" className="text-lg font-semibold">
              {t("import.title")}
            </h2>
            {imported ? (
              <Link href={`${base}/contract/versions`} className="text-link text-sm font-bold">
                {t("import.versions", { count: 3 })}
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
              <b className="text-[15px]">{file ? file.name : t("import.drop")}</b>
              <span className="text-muted text-[13px]">
                {file ? `${(file.size / 1024).toFixed(1)} KB` : t("import.limits")}
              </span>
              <input
                id="contract-file"
                ref={inputRef}
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
          <Button onClick={() => void importContract()} loading={importing}>
            {importing ? t("import.importing") : t("import.submit")}
          </Button>
        </section>
      </div>

      {imported ? (
        <>
          <section aria-labelledby="contract-warnings" className="flex flex-col gap-3">
            <h2 id="contract-warnings" className="text-lg font-semibold">
              {t("warnings", { count: 3 })}
            </h2>
            <ApiWarnings
              warnings={[
                { code: "contract.servers_mismatch" },
                { code: "contract.external_reference" },
                {
                  code: "contract.unparsed_element",
                  message: "#/paths/~1orders~1{orderId}/get/parameters/2",
                },
              ]}
            />
          </section>

          <section aria-labelledby="contract-ops" className={cn(card, "gap-5 p-6 sm:p-8")}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="contract-ops" className="text-lg font-semibold">
                {t("operations.title", { count: 42 })}
              </h2>
              <div className="flex flex-wrap items-center gap-2.5">
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
                      onClick={() => setMethod(m)}
                      className={cn(
                        "min-h-9 cursor-pointer rounded-full px-3.5 text-[13px] font-semibold",
                        method === m ? "bg-accent text-on-accent" : "border-line bg-panel-2 border",
                      )}
                    >
                      {m === "all" ? t("operations.all") : m}
                    </button>
                  ))}
                </div>
                <label htmlFor="op-search" className="sr-only">
                  {t("operations.search")}
                </label>
                <input
                  id="op-search"
                  type="search"
                  placeholder={t("operations.searchPlaceholder")}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className={cn(inputClass, "min-h-10 w-[240px] text-sm")}
                />
              </div>
            </div>

            <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
              {operations.map((o, i) => {
                const expanded = open === i;
                return (
                  <li
                    key={`${o.method}${o.path}`}
                    className={cn(
                      "rounded-[18px] border",
                      expanded ? "border-line bg-panel-2" : "border-transparent",
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-3 px-3.5 py-2.5">
                      <MethodBadge method={o.method} />
                      <code className="font-mono text-sm break-all">{o.path}</code>
                      <span className="text-muted min-w-[160px] flex-1 text-sm">{o.summary}</span>
                      <span className="text-muted text-[13px]">{o.params}</span>
                      <span className="text-[13px]">{t(`operations.security.${o.security}`)}</span>
                      <button
                        type="button"
                        aria-expanded={expanded}
                        aria-label={t("operations.detail", { method: o.method, path: o.path })}
                        onClick={() => setOpen(expanded ? null : i)}
                        className="border-line text-fg inline-flex size-9 cursor-pointer items-center justify-center rounded-xl border"
                      >
                        <Icon name={expanded ? "chevronUp" : "chevronDown"} size={16} />
                      </button>
                    </div>
                    {expanded ? (
                      <div className="border-line grid gap-4 border-t px-4 py-4 sm:grid-cols-3">
                        <div className="flex flex-col gap-2">
                          <b className="text-sm">{t("operations.params")}</b>
                          <div className="text-[13px]">
                            <code className="font-mono">orderId</code>{" "}
                            <span className="text-muted">{t("operations.paramPath")}</span>
                          </div>
                          <div className="text-[13px]">
                            <code className="font-mono">include</code>{" "}
                            <span className="text-muted">{t("operations.paramQuery")}</span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <b className="text-sm">{t("operations.responses")}</b>
                          {[
                            ["200", "Order"],
                            ["401", t("operations.r401")],
                            ["404", t("operations.r404")],
                          ].map(([code, text]) => (
                            <div key={code} className="text-[13px]">
                              <code className="font-mono">{code}</code>{" "}
                              <span className="text-muted">{text}</span>
                            </div>
                          ))}
                        </div>
                        <div className="flex flex-col gap-2">
                          <b className="text-sm">{t("operations.declaredSecurity")}</b>
                          <code className="font-mono text-[13px]">bearerAuth (HTTP, JWT)</code>
                          <Link href={`${base}/policy`} className="text-link text-[13px] font-bold">
                            {t("operations.seePolicy")}
                          </Link>
                        </div>
                      </div>
                    ) : null}
                  </li>
                );
              })}
              {operations.length === 0 ? (
                <li className="text-muted px-3 py-6 text-center text-sm">{t("operations.none")}</li>
              ) : null}
            </ul>
            <span className="text-muted text-[13px]">
              {t("operations.showing", { shown: operations.length, total: 42 })}
            </span>
          </section>
        </>
      ) : null}

      {!imported ? (
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
    >
      {(project) => <Contract key={project.id} project={project} />}
    </ProjectShell>
  );
}
