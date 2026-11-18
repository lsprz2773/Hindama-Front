"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { HelpPanel } from "@/components/ui/help-panel";
import { Icon } from "@/components/ui/icon";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { ProjectShell } from "@/features/projects/project-shell";
import { hostOf, updateProject, type Project } from "@/features/projects/store";
import { VERIFICATION_CODE } from "./data";

type Method = "file" | "dns";
type Failure = "mismatch" | "notFound" | null;

function CodeLine({ value, what }: { value: string; what: string }) {
  return (
    <div className="border-line bg-code-bg flex items-center gap-2.5 rounded-2xl border py-2 pr-2 pl-4">
      <code className="min-w-0 flex-1 font-mono text-sm break-all">{value}</code>
      <CopyButton
        value={value}
        what={what}
        size="sm"
        className="min-h-10 rounded-xl px-3.5 text-sm"
      />
    </div>
  );
}

function Verification({ project }: { project: Project }) {
  const t = useTranslations("Verification");
  const toast = useToast();
  const [method, setMethod] = useState<Method>("file");
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<Failure>(null);
  const [attempts, setAttempts] = useState(0);
  const host = hostOf(project.baseUrl);
  const fileUrl = `${project.baseUrl.startsWith("http:") ? "http" : "https"}://${host}/.well-known/hindama-verificacion.txt`;

  async function verify() {
    if (pending) return;
    setPending(true);
    setFailure(null);
    await new Promise((resolve) => setTimeout(resolve, 900)); // TODO(api): hasta 20 s
    setPending(false);
    setAttempts((n) => n + 1);
    // Simulación: el primer intento con archivo no coincide; después se verifica.
    if (attempts === 0 && method === "file") {
      setFailure("mismatch");
      return;
    }
    updateProject(project.id, { verified: true });
    toast.show({ type: "success", title: t("success") });
  }

  const steps =
    method === "dns"
      ? [
          {
            text: t("dns.step1"),
            value: `_hindama-verificacion.${host}`,
            what: t("dns.hostLabel"),
          },
          { text: t("dns.step2"), value: VERIFICATION_CODE, what: t("dns.valueLabel") },
          { text: t("dns.step3") },
        ]
      : [
          { text: t("file.step1") },
          { text: t("file.step2"), value: fileUrl, what: t("file.urlLabel") },
          { text: t("file.step3") },
        ];

  return (
    <div className="flex flex-wrap items-start gap-5">
      <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-5">
        {project.verified ? (
          <Banner tone="success" title={t("verifiedTitle")}>
            {t("verifiedText", { host })}
          </Banner>
        ) : null}

        <section
          aria-labelledby="ver-code"
          className="border-line flex flex-col gap-[18px] rounded-[28px] border bg-[image:var(--hero)] p-6 sm:p-8"
        >
          <StatusBadge
            kind="project"
            status={project.verified ? "verified" : "pendingVerification"}
            className="self-start"
          />
          <h2 id="ver-code" className="text-base font-semibold">
            {t("codeTitle")}
          </h2>
          <div className="flex flex-wrap items-center gap-4">
            <code className="font-mono text-[26px] font-medium tracking-[0.02em] break-all sm:text-[30px]">
              {VERIFICATION_CODE}
            </code>
            <CopyButton value={VERIFICATION_CODE} label={t("copyCode")} />
          </div>
          <p className="text-muted max-w-[62ch] text-sm leading-[1.55]">
            {t.rich("codeText", {
              host,
              code: (chunks) => <code className="font-mono">{chunks}</code>,
            })}
          </p>
        </section>

        <section
          aria-labelledby="ver-method"
          className="border-line bg-panel flex flex-col gap-5 rounded-[28px] border p-6 backdrop-blur-lg sm:p-7"
        >
          <h2 id="ver-method" className="text-lg font-semibold">
            {t("methodTitle")}
          </h2>
          <div
            role="tablist"
            aria-label={t("methodLabel")}
            className="border-line bg-panel-2 flex flex-wrap gap-1.5 self-start rounded-[18px] border p-1.5"
          >
            {(["file", "dns"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={method === m}
                onClick={() => {
                  setMethod(m);
                  setFailure(null);
                }}
                className={cn(
                  "min-h-11 cursor-pointer rounded-[13px] px-[18px] text-[15px] font-semibold",
                  method === m ? "bg-accent text-on-accent" : "text-fg",
                )}
              >
                {t(`${m}.tab`)}
              </button>
            ))}
          </div>

          <ol role="tabpanel" className="m-0 flex list-none flex-col gap-[18px] p-0">
            {steps.map((step, i) => (
              <li key={step.text} className="flex gap-3.5">
                <span
                  aria-hidden="true"
                  className="bg-progress-bg text-accent inline-flex size-[30px] flex-none items-center justify-center rounded-full text-sm font-bold"
                >
                  {i + 1}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-2.5 pt-1">
                  <span className="text-[15px] leading-[1.5]">{step.text}</span>
                  {step.value ? <CodeLine value={step.value} what={step.what ?? ""} /> : null}
                </div>
              </li>
            ))}
          </ol>

          {method === "dns" ? (
            <Banner tone="info" title={t("dns.noteTitle")}>
              {t("dns.noteText")}
            </Banner>
          ) : null}

          <div className="border-line flex flex-wrap items-center gap-3.5 border-t pt-[18px]">
            <Button size="lg" onClick={() => void verify()} loading={pending}>
              {pending ? null : <Icon name="refresh" size={18} />}
              {pending ? t("verifying") : t("verify")}
            </Button>
            <span className="text-muted text-sm">
              {attempts > 0 ? t("lastAttempt") : t("noAttempts")}
            </span>
          </div>
        </section>

        {failure ? (
          <section
            aria-labelledby="ver-result"
            role="status"
            className="border-line bg-panel flex flex-col gap-[18px] rounded-[28px] border p-6 backdrop-blur-lg sm:p-7"
          >
            <div className="flex items-center gap-3">
              <Icon name="alert" size={22} className="text-warning" />
              <h2 id="ver-result" className="text-lg font-semibold">
                {t(`failure.${failure}.title`)}
              </h2>
            </div>
            {failure === "mismatch" ? (
              <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
                <div className="border-line bg-panel-2 flex flex-col gap-1.5 rounded-[20px] border px-4 py-3.5">
                  <span className="text-muted text-[13px]">{t("failure.expected")}</span>
                  <code className="font-mono text-sm break-all">{VERIFICATION_CODE}</code>
                </div>
                <div className="border-line bg-panel-2 flex flex-col gap-1.5 rounded-[20px] border px-4 py-3.5">
                  <span className="text-muted text-[13px]">{t("failure.found")}</span>
                  <code className="font-mono text-sm break-all whitespace-pre-wrap">{`${VERIFICATION_CODE}\\n`}</code>
                </div>
              </div>
            ) : null}
            <p className="text-sm leading-[1.55]">
              <b>{t("failure.howTitle")}</b>{" "}
              <span className="text-muted">{t(`failure.${failure}.how`)}</span>
            </p>
          </section>
        ) : null}
      </div>

      <aside className="flex min-w-[280px] flex-[1_1_300px] flex-col gap-5">
        <HelpPanel title={t("help.whyTitle")}>
          <p>{t("help.whyText")}</p>
        </HelpPanel>
        <HelpPanel title={t("help.everyRunTitle")}>
          <p>{t("help.everyRunText")}</p>
        </HelpPanel>
        <HelpPanel title={t("help.commonTitle")}>
          <ul>
            <li>{t("help.common1")}</li>
            <li>{t("help.common2")}</li>
            <li>{t("help.common3")}</li>
            <li>{t("help.common4")}</li>
            <li>{t("help.common5")}</li>
          </ul>
        </HelpPanel>
      </aside>
    </div>
  );
}

/** V-18. Verificación de propiedad del host con un archivo o un registro DNS TXT (RF-17 a RF-21). */
export function VerificationView({ id }: { id: string }) {
  const t = useTranslations("Verification");
  return (
    <ProjectShell id={id} section={t("crumb")} title={t("title")}>
      {(project) => <Verification key={project.id} project={project} />}
    </ProjectShell>
  );
}
