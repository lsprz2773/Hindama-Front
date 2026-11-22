"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { ApiWarnings } from "@/components/ui/api-warnings";
import { Banner } from "@/components/ui/banner";
import { ButtonLink } from "@/components/ui/button";
import { MethodBadge } from "@/components/ui/method-badge";
import { cn } from "@/lib/cn";
import { Link } from "@/i18n/navigation";
import { ProjectShell } from "@/features/projects/project-shell";
import { CHANGES_VS_V220, CHANGES_VS_V231, CONTRACT_VERSIONS, type Change } from "./data";

const KIND_STYLE: Record<
  Change["kind"],
  { sign: string; color: string; bg: string; border: string }
> = {
  added: { sign: "+", color: "text-success", bg: "bg-success-bg", border: "border-l-success" },
  modified: { sign: "~", color: "text-warning", bg: "bg-warning-bg", border: "border-l-warning" },
  removed: { sign: "−", color: "text-danger", bg: "bg-danger-bg", border: "border-l-danger" },
};

function Versions({ id }: { id: string }) {
  const t = useTranslations("ContractVersions");
  const format = useFormatter();
  const [compare, setCompare] = useState("v2.3.1");
  const changes = compare === "v2.3.1" ? CHANGES_VS_V231 : CHANGES_VS_V220;
  const counts = {
    added: changes.filter((c) => c.kind === "added").length,
    modified: changes.filter((c) => c.kind === "modified").length,
    removed: changes.filter((c) => c.kind === "removed").length,
  };
  const base = `/projects/${id}`;

  return (
    <div className="flex flex-wrap items-start gap-5">
      <section
        aria-labelledby="versions-list"
        className="border-line bg-panel flex min-w-[300px] flex-[1_1_320px] flex-col gap-4 rounded-[28px] border p-6 backdrop-blur-lg"
      >
        <h2 id="versions-list" className="text-lg font-semibold">
          {t("count", { count: CONTRACT_VERSIONS.length })}
        </h2>
        <ol className="stagger m-0 flex list-none flex-col gap-2 p-0">
          {CONTRACT_VERSIONS.map((v, index) => {
            const current = index === 0;
            const selected = v.name === compare;
            return (
              <li key={v.name}>
                <button
                  type="button"
                  disabled={current}
                  aria-pressed={selected}
                  onClick={() => setCompare(v.name)}
                  className={cn(
                    "bg-panel-2 flex w-full flex-col gap-1.5 rounded-[20px] border p-4 text-left",
                    current || selected ? "border-accent/55" : "border-line",
                    current ? "cursor-default" : "cursor-pointer",
                  )}
                >
                  <span className="flex items-baseline justify-between gap-2.5">
                    <b className="text-base">{v.name}</b>
                    <span
                      className={cn(
                        "text-[12.5px] font-bold",
                        current ? "text-success" : "text-link",
                      )}
                    >
                      {current ? t("current") : selected ? t("comparing") : ""}
                    </span>
                  </span>
                  <span className="text-muted text-[13.5px]">
                    {format.dateTime(new Date(v.date), { dateStyle: "medium", timeZone: "UTC" })} ·{" "}
                    {v.origin === "URL"
                      ? t("originUrl")
                      : v.origin === "file"
                        ? t("originFile")
                        : t("originFileNamed", { name: v.origin })}
                  </span>
                  <span className="text-muted text-[13.5px]">
                    {t("operations", { count: v.operations })}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
        <div className="flex flex-col gap-2">
          <span className="text-muted text-[13px] font-bold">
            {t("warningsOf", { version: "v2.4.0" })}
          </span>
          <ApiWarnings
            warnings={[
              {
                code: "contract.unparsed_element",
                location: "/paths/~1orders~1{orderId}/get/parameters/2",
              },
            ]}
          />
        </div>
        <ButtonLink href={`${base}/contract`} variant="secondary">
          {t("back")}
        </ButtonLink>
      </section>

      <div className="flex min-w-0 flex-[999_1_600px] flex-col gap-5">
        <section
          aria-labelledby="versions-diff"
          className="border-line flex flex-col gap-5 rounded-[28px] border bg-[image:var(--hero)] p-6 sm:p-[30px]"
        >
          <h2
            id="versions-diff"
            className="font-display text-4xl leading-none font-medium tracking-[-0.03em]"
          >
            {t("diffTitle", { from: "v2.4.0", to: compare })}
          </h2>
          <ul className="stagger m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3 p-0">
            {(["added", "modified", "removed"] as const).map((kind) => (
              <li
                key={kind}
                className="border-line bg-panel-2 flex items-center gap-3.5 rounded-[20px] border px-[18px] py-4"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "inline-flex size-9 items-center justify-center rounded-xl text-xl font-bold",
                    KIND_STYLE[kind].bg,
                    KIND_STYLE[kind].color,
                  )}
                >
                  {KIND_STYLE[kind].sign}
                </span>
                <span className="flex flex-col">
                  <span className="font-display text-[28px] leading-none font-medium tabular-nums">
                    {counts[kind]}
                  </span>
                  <span className="text-muted text-[13.5px]">
                    {t(`summary.${kind}`, { count: counts[kind] })}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <Banner title={t("reviewPolicy.title")}>
          {t("reviewPolicy.text", { count: counts.added })}{" "}
          <Link href={`${base}/policy`} className="text-link font-semibold">
            {t("reviewPolicy.link")}
          </Link>
        </Banner>

        <section
          aria-labelledby="versions-changes"
          className="border-line bg-panel flex flex-col gap-2.5 rounded-[28px] border p-6 backdrop-blur-lg"
        >
          <h2 id="versions-changes" className="text-lg font-semibold">
            {t("changes")}
          </h2>
          <ul className="stagger m-0 flex list-none flex-col gap-2 p-0">
            {changes.map((c) => {
              const style = KIND_STYLE[c.kind];
              return (
                <li
                  key={`${c.kind}${c.method}${c.path}`}
                  className={cn(
                    "border-line bg-panel-2 flex flex-col gap-2 rounded-[18px] border border-l-4 px-3.5 py-3",
                    style.border,
                  )}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="flex min-w-24 items-center gap-1.5 text-[12.5px] font-bold">
                      <span aria-hidden="true" className={cn("text-base", style.color)}>
                        {style.sign}
                      </span>
                      {t(`kind.${c.kind}`)}
                    </span>
                    <MethodBadge method={c.method} />
                    <code
                      className={cn("font-mono text-sm", c.kind === "removed" && "line-through")}
                    >
                      {c.path}
                    </code>
                  </div>
                  {c.detail ? (
                    <span className="text-muted text-[13.5px] leading-[1.5] sm:pl-[108px]">
                      {t(`details.${c.detail as "patch" | "list" | "delete" | "health"}`)}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}

/** V-20. Versiones importadas del contrato y diferencias entre ellas (RF-26). */
export function VersionsView({ id }: { id: string }) {
  const t = useTranslations("ContractVersions");
  const c = useTranslations("Contract");
  return (
    <ProjectShell
      id={id}
      trail={[{ label: c("crumb"), href: `/projects/${id}/contract` }, { label: t("crumb") }]}
      title={t("title")}
    >
      {() => <Versions id={id} />}
    </ProjectShell>
  );
}
