"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import { Button, ButtonLink } from "@/components/ui/button";
import { HelpPanel } from "@/components/ui/help-panel";
import { Icon } from "@/components/ui/icon";
import { inputClass, TextField } from "@/components/ui/text-field";
import { useToast } from "@/components/ui/toast";
import { ErrorPanel } from "@/features/errors/error-panel";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { ProjectShell } from "@/features/projects/project-shell";
import type { Project } from "@/features/projects/store";
import type { AuthForm, Identity, IdentityRole } from "./data";
import { identityId, useIdentities } from "./identities";

const FORMS: AuthForm[] = ["login", "bearer", "cookie", "header"];
const ROLES: IdentityRole[] = ["admin", "user", "other"];
const OPERATIONS = ["GET /orders", "GET /orders/{orderId}", "GET /users/me"];

/** Campos de cada forma de autenticación; `secret` se guarda cifrado y solo se ve su final. */
type FieldKey =
  | "user"
  | "password"
  | "endpoint"
  | "token"
  | "cookieName"
  | "cookieValue"
  | "headerName"
  | "headerValue";

const FIELDS: Record<AuthForm, { key: FieldKey; secret?: boolean }[]> = {
  login: [{ key: "user" }, { key: "password", secret: true }, { key: "endpoint" }],
  bearer: [{ key: "token", secret: true }],
  cookie: [{ key: "cookieName" }, { key: "cookieValue", secret: true }],
  header: [{ key: "headerName" }, { key: "headerValue", secret: true }],
};

/** Nombre válido de cabecera o cookie (RFC 9110, «token»): sin espacios ni separadores. */
const TOKEN = /^[A-Za-z0-9!#$%&'*+.^_`|~-]+$/;

type TestResult = { ok: boolean } | null;

function IdentityForm({ project, identity }: { project: Project; identity?: Identity }) {
  const t = useTranslations("IdentityForm");
  const router = useRouter();
  const toast = useToast();
  const { identities, save } = useIdentities(project.id);
  const editing = Boolean(identity);
  const base = `/projects/${project.id}/identities`;

  const [name, setName] = useState(identity?.name ?? "");
  const [role, setRole] = useState<IdentityRole>(identity?.role ?? "user");
  const [roleNote, setRoleNote] = useState(identity?.roleNote ?? "");
  const [auth, setAuth] = useState<AuthForm>(
    identity && identity.auth !== "none" ? identity.auth : "bearer",
  );
  const [values, setValues] = useState<Record<string, string>>({});
  const [replacing, setReplacing] = useState<Record<string, boolean>>({});
  const [operation, setOperation] = useState(OPERATIONS[0]);
  const [result, setResult] = useState<TestResult>(null);
  const [testing, setTesting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmFailed, setConfirmFailed] = useState(false);

  const keepsSecret = editing && identity?.auth === auth;
  const fields = FIELDS[auth];

  function validate() {
    const next: Record<string, string> = {};
    const trimmed = name.trim();
    if (!trimmed) next.name = t("errors.nameRequired");
    else if (trimmed.length > 60) next.name = t("errors.nameTooLong");
    else if (
      identities.some(
        (i) => i.id !== identity?.id && i.name.toLowerCase() === trimmed.toLowerCase(),
      )
    )
      next.name = t("errors.nameTaken");
    for (const field of fields) {
      const hidden = field.secret && keepsSecret && !replacing[field.key];
      const value = values[field.key]?.trim() ?? "";
      if (hidden) continue;
      if (!value) next[field.key] = t("errors.fieldRequired");
      else if (field.key === "endpoint" && !/^(\/|https?:\/\/)\S+$/i.test(value))
        next[field.key] = t("errors.endpoint");
      else if ((field.key === "headerName" || field.key === "cookieName") && !TOKEN.test(value))
        next[field.key] = t("errors.tokenName");
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function runTest() {
    setTesting(true);
    await new Promise((resolve) => setTimeout(resolve, 700)); // TODO(api): probar la credencial
    const replaced = fields.some((f) => f.secret && replacing[f.key]);
    const expired = identity?.status === "expiredCredential" && !replaced;
    const typedExpired = fields.some(
      (f) => f.secret && values[f.key]?.toLowerCase().includes("expirado"),
    );
    setResult({ ok: !(expired || typedExpired) });
    setTesting(false);
  }

  function persist() {
    const secretField = fields.find((f) => f.secret);
    const typed = secretField ? values[secretField.key] : "";
    const next: Identity = {
      id:
        identity?.id ??
        identityId(
          name,
          identities.map((i) => i.id),
        ),
      name: name.trim(),
      role,
      roleNote: role === "other" ? roleNote.trim() || undefined : undefined,
      auth,
      last4: typed ? typed.slice(-4) : (identity?.last4 ?? null),
      status: result
        ? result.ok
          ? "active"
          : "expiredCredential"
        : (identity?.status ?? "untested"),
      testedAgo: result?.ok ? "0 min" : undefined,
      resources: identity?.resources ?? 0,
    };
    save(next);
    toast.show({ type: "success", title: t("saved", { name: next.name }) });
    router.push(base);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!validate()) return;
    // Guardar con una prueba fallida pide confirmación explícita (catálogo de modales).
    if (result && !result.ok) setConfirmFailed(true);
    else persist();
  }

  return (
    <div className="flex flex-wrap items-start gap-5">
      <form
        noValidate
        onSubmit={onSubmit}
        className="border-line bg-panel flex min-w-0 flex-[999_1_600px] flex-col gap-6 rounded-[28px] border p-6 backdrop-blur-lg sm:p-8"
      >
        <TextField
          label={t("name")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
        />

        <div className="flex flex-col gap-2.5">
          <span id="identity-role" className="text-sm font-semibold">
            {t("role.label")}
          </span>
          <div
            role="radiogroup"
            aria-labelledby="identity-role"
            className="border-line bg-panel-2 flex flex-wrap gap-1.5 self-start rounded-2xl border p-1.5"
          >
            {ROLES.map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={role === r}
                onClick={() => setRole(r)}
                className={cn(
                  "min-h-[42px] cursor-pointer rounded-[11px] px-4 text-[14.5px] font-semibold",
                  role === r ? "bg-accent text-on-accent" : "text-fg",
                )}
              >
                {t(`role.${r}`)}
              </button>
            ))}
          </div>
          {role === "other" ? (
            <TextField
              label={t("role.otherName")}
              value={roleNote}
              onChange={(e) => setRoleNote(e.target.value)}
            />
          ) : null}
          <span className="text-muted text-[13.5px]">{t("role.hint")}</span>
        </div>

        <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
          <legend className="mb-2.5 p-0 text-sm font-semibold">{t("auth.label")}</legend>
          <div
            role="radiogroup"
            className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-2.5"
          >
            {FORMS.map((f) => (
              <button
                key={f}
                type="button"
                role="radio"
                aria-checked={auth === f}
                onClick={() => {
                  setAuth(f);
                  setValues({});
                  setReplacing({});
                  setErrors({});
                  setResult(null);
                }}
                className={cn(
                  "bg-panel-2 flex cursor-pointer flex-col gap-1 rounded-[18px] border-2 px-4 py-3.5 text-left",
                  auth === f ? "border-accent" : "border-line",
                )}
              >
                <b className="text-[15px]">{t(`auth.${f}.title`)}</b>
                <span className="text-muted text-[13px]">{t(`auth.${f}.note`)}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <div className="border-line bg-panel-2 grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4 rounded-[20px] border p-5">
          {fields.map((field) => {
            const masked = field.secret && keepsSecret && !replacing[field.key];
            const id = `identity-${field.key}`;
            return (
              <div key={field.key} className="flex flex-col gap-2">
                {masked ? (
                  <>
                    <span className="text-sm font-semibold">{t(`fields.${field.key}`)}</span>
                    <div className="flex items-center gap-2">
                      <code className="border-line bg-code-bg flex-1 rounded-2xl border px-4 py-3.5 font-mono text-[15px]">
                        {t("endsIn", { last4: identity?.last4 ?? "" })}
                      </code>
                      <Button
                        variant="secondary"
                        onClick={() => setReplacing((r) => ({ ...r, [field.key]: true }))}
                      >
                        {t("replace")}
                      </Button>
                    </div>
                  </>
                ) : (
                  <TextField
                    id={id}
                    label={t(`fields.${field.key}`)}
                    type={field.secret ? "password" : "text"}
                    autoComplete="off"
                    value={values[field.key] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                    error={errors[field.key]}
                  />
                )}
              </div>
            );
          })}
          {auth === "login" ? (
            <span className="text-muted col-span-full text-[13.5px] leading-[1.5]">
              {t("loginNote")}
            </span>
          ) : null}
        </div>

        <div className="border-line bg-panel-2 flex flex-col gap-3 rounded-[20px] border p-5">
          <b className="text-[15px]">{t("test.title")}</b>
          <div className="flex flex-wrap items-end gap-2.5">
            <div className="flex min-w-[260px] flex-[1_1_260px] flex-col gap-2">
              <label htmlFor="identity-op" className="text-muted text-[13.5px]">
                {t("test.operation")}
              </label>
              <select
                id="identity-op"
                value={operation}
                onChange={(e) => setOperation(e.target.value)}
                className={cn(inputClass, "font-mono text-sm")}
              >
                {OPERATIONS.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </div>
            <Button variant="secondary" onClick={() => void runTest()} loading={testing}>
              {testing ? null : <Icon name="refresh" size={16} />}
              {testing ? t("test.testing") : t("test.run")}
            </Button>
          </div>
          {result ? (
            <div role="status" className="flex items-start gap-2.5 text-sm leading-[1.5]">
              <Icon
                name={result.ok ? "check" : "alert"}
                className={result.ok ? "text-success" : "text-danger"}
                strokeWidth={2.4}
              />
              <span>
                <b>{result.ok ? t("test.ok") : t("test.failed")}</b>{" "}
                <span className="text-muted">
                  {result.ok ? t("test.okText") : t("test.failedText")}
                </span>
              </span>
            </div>
          ) : null}
        </div>

        <div className="border-line flex flex-wrap justify-end gap-3 border-t pt-1.5">
          <ButtonLink href={base} variant="secondary">
            {t("cancel")}
          </ButtonLink>
          <Button type="submit">{t("save")}</Button>
        </div>
      </form>

      <aside className="flex min-w-[280px] flex-[1_1_300px] flex-col gap-5">
        <HelpPanel title={t("help.encryptedTitle")} icon="lock">
          <p>{t("help.encryptedText")}</p>
        </HelpPanel>
        <HelpPanel title={t("help.whichTitle")}>
          <ul>
            <li>
              <b>{t("auth.login.title")}</b> {t("help.login")}
            </li>
            <li>
              <b>{t("auth.bearer.title")}</b> {t("help.bearer")}
            </li>
            <li>
              <b>{t("auth.cookie.title")}</b> {t("help.cookie")}
            </li>
            <li>
              <b>{t("auth.header.title")}</b> {t("help.header")}
            </li>
          </ul>
        </HelpPanel>
      </aside>

      <ConfirmDialog
        open={confirmFailed}
        onOpenChange={setConfirmFailed}
        title={t("failedDialog.title")}
        description={t("failedDialog.text")}
        confirmLabel={t("failedDialog.confirm")}
        cancelLabel={t("failedDialog.cancel")}
        onConfirm={async () => persist()}
      />
    </div>
  );
}

/** V-22. Agregar, editar y probar una identidad (credenciales cifradas, solo se ven los últimos 4). */
export function IdentityFormView({ id, identityId: editId }: { id: string; identityId?: string }) {
  const t = useTranslations("IdentityForm");
  const list = useTranslations("Identities");
  return (
    <ProjectShell
      id={id}
      trail={[
        { label: list("crumb"), href: `/projects/${id}/identities` },
        { label: editId ? editId : t("newCrumb") },
      ]}
      title={editId ? t("editTitle") : t("newTitle")}
    >
      {(project) => <IdentityLoader project={project} editId={editId} />}
    </ProjectShell>
  );
}

function IdentityLoader({ project, editId }: { project: Project; editId?: string }) {
  const { identities } = useIdentities(project.id);
  const identity = editId ? identities.find((i) => i.id === editId) : undefined;
  if (editId && !identity) return <ErrorPanel code={404} standalone={false} />;
  return <IdentityForm key={identity?.id ?? "new"} project={project} identity={identity} />;
}
