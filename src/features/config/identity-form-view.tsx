"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { FormSkeleton } from "@/components/skeletons/page-skeletons";
import { Button, ButtonLink } from "@/components/ui/button";
import { HelpPanel } from "@/components/ui/help-panel";
import { Icon } from "@/components/ui/icon";
import { QueryState } from "@/components/ui/query-state";
import { inputClass, TextField } from "@/components/ui/text-field";
import { useToast } from "@/components/ui/toast";
import { ErrorPanel } from "@/features/errors/error-panel";
import { useRouter } from "@/i18n/navigation";
import {
  identityCreateSchema,
  identityUpdateSchema,
  type CreatableAuthType,
  type Credential,
  type Identity,
  type IdentityRole,
  type IdentityTest,
} from "@/lib/api/schemas/identities";
import type { Project } from "@/lib/api/schemas/projects";
import { fieldErrors } from "@/lib/api/zod";
import { cn } from "@/lib/cn";
import { ApiError } from "@/lib/http";
import { useHttpClient } from "@/lib/http/browser";
import { ProjectShell } from "@/features/projects/project-shell";
import {
  createIdentity,
  testIdentity,
  updateIdentity,
  useAfterIdentities,
  useIdentities,
  useOperations,
} from "./api";

const FORMS: CreatableAuthType[] = ["login", "bearer", "cookie", "header"];
const ROLES: IdentityRole[] = ["admin", "user", "other"];

/** Campos de la credencial de cada forma; los secretos nunca se muestran ni se guardan aquí. */
type SecretKey = "username" | "password" | "token" | "value";
const SECRETS: Record<CreatableAuthType, SecretKey[]> = {
  login: ["username", "password"],
  bearer: ["token"],
  cookie: ["value"],
  header: ["value"],
};

/** Código de error (de Zod o de la API) → clave de texto del formulario. */
const FIELD_MESSAGES: Record<string, string> = {
  "validation.required": "fieldRequired",
  "validation.length": "length",
  "validation.format": "format",
  "identity.name_taken": "nameTaken",
  "identity.credential_mismatch": "fieldRequired",
  "identity.credential_required": "fieldRequired",
  "identity.field_name_required": "fieldRequired",
  "identity.field_name_reserved": "fieldNameReserved",
  "identity.login_operation_required": "loginOperation",
};

function credentialFor(auth: CreatableAuthType, values: Record<SecretKey, string>): Credential {
  if (auth === "login") return { username: values.username, password: values.password };
  if (auth === "bearer") return { token: values.token };
  return { value: values.value };
}

const EMPTY: Record<SecretKey, string> = { username: "", password: "", token: "", value: "" };

function IdentityForm({ project, identity }: { project: Project; identity?: Identity }) {
  const t = useTranslations("IdentityForm");
  const router = useRouter();
  const toast = useToast();
  const http = useHttpClient();
  const afterChange = useAfterIdentities(project.id);
  const editing = Boolean(identity);
  const base = `/projects/${project.id}/identities`;
  const initialAuth: CreatableAuthType =
    identity && identity.auth_type !== "none" ? identity.auth_type : "bearer";

  const [name, setName] = useState(identity?.name ?? "");
  const [role, setRole] = useState<IdentityRole>(identity?.role ?? "user");
  const [roleLabel, setRoleLabel] = useState(identity?.role_label ?? "");
  const [auth, setAuth] = useState<CreatableAuthType>(initialAuth);
  const [fieldName, setFieldName] = useState(identity?.field_name ?? "");
  const [loginOperation, setLoginOperation] = useState(identity?.login_operation?.id ?? "");
  // La credencial vive solo en memoria mientras se escribe; se envía una vez y se descarta.
  const [secrets, setSecrets] = useState<Record<SecretKey, string>>(EMPTY);
  const [replacing, setReplacing] = useState(!editing);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<IdentityTest | null>(null);

  const operations = useOperations(project.id, { pageSize: 500 });
  const loginCandidates = (operations.data?.items ?? []).filter(
    (o) => o.is_login_candidate || o.id === loginOperation,
  );
  // Cambiar la forma exige una credencial nueva (`identity.credential_required`).
  const sendsCredential = replacing || auth !== initialAuth;

  const message = (code: string | undefined) =>
    t(`errors.${(code && FIELD_MESSAGES[code]) || "format"}` as never);

  function mapFields(fields: Record<string, readonly string[]>) {
    const next: Record<string, string> = {};
    for (const [field, codes] of Object.entries(fields)) {
      const key = field.startsWith("credential")
        ? (field.split(".")[1] ?? SECRETS[auth][0])
        : field;
      next[key] ??=
        key === "name" && codes[0] === "validation.required"
          ? t("errors.nameRequired")
          : message(codes[0]);
    }
    return next;
  }

  function payload() {
    const credential = sendsCredential ? credentialFor(auth, secrets) : undefined;
    const usesField = auth === "cookie" || auth === "header";
    const common = {
      name,
      role,
      role_label: roleLabel,
      auth_type: auth,
      field_name: usesField ? fieldName : null,
      login_operation_id: auth === "login" ? loginOperation || null : null,
    };
    if (!identity) {
      return identityCreateSchema.safeParse({ ...common, credential });
    }
    // Solo los campos que cambiaron.
    const changes: Record<string, unknown> = {};
    if (name.trim() !== identity.name) changes.name = name;
    if (role !== identity.role) changes.role = role;
    if ((common.role_label ?? "") !== (identity.role_label ?? ""))
      changes.role_label = common.role_label;
    if (auth !== initialAuth) changes.auth_type = auth;
    if (credential) changes.credential = credential;
    if ((common.field_name ?? "") !== (identity.field_name ?? ""))
      changes.field_name = common.field_name;
    if ((common.login_operation_id ?? "") !== (identity.login_operation?.id ?? "")) {
      changes.login_operation_id = common.login_operation_id;
    }
    return identityUpdateSchema.safeParse(changes);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setGeneral(undefined);
    const parsed = payload();
    if (!parsed.success) {
      const fields = fieldErrors(parsed.error);
      if (identity && fields._) return router.push(base); // sin cambios
      return setErrors(mapFields(fields));
    }
    setErrors({});
    setSaving(true);
    try {
      const saved = identity
        ? await updateIdentity(http, project.id, identity.id, parsed.data)
        : await createIdentity(http, project.id, parsed.data as never);
      setSecrets(EMPTY);
      afterChange();
      toast.show({ type: "success", title: t("saved", { name: saved.name }) });
      router.push(base);
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      if (error.code === "identity.name_taken") setErrors({ name: t("errors.nameTaken") });
      else if (error.code === "identity.limit_reached") setGeneral(t("errors.limitReached"));
      else if (error.status === 422) setErrors(mapFields(error.fields));
      else if (error.status === 429) setGeneral(t("errors.rateLimited"));
      else
        setGeneral(
          error.requestId ? t("errors.reference", { id: error.requestId }) : t("errors.failed"),
        );
    } finally {
      setSaving(false);
    }
  }

  async function runTest() {
    if (!identity || testing) return;
    setTesting(true);
    setResult(null);
    try {
      const outcome = await testIdentity(http, project.id, identity.id);
      setResult(outcome);
      afterChange();
    } catch (error) {
      setGeneral(
        error instanceof ApiError && error.code === "project.not_verified"
          ? t("errors.notVerified")
          : error instanceof ApiError && error.code === "identity.no_test_operation"
            ? t("errors.noTestOperation")
            : t("errors.failed"),
      );
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="flex flex-wrap items-start gap-5">
      <form
        noValidate
        onSubmit={(e) => void onSubmit(e)}
        className="border-line bg-panel flex min-w-0 flex-[999_1_600px] flex-col gap-6 rounded-[28px] border p-6 backdrop-blur-lg sm:p-8"
      >
        <TextField
          label={t("name")}
          value={name}
          maxLength={100}
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
          <TextField
            label={t("role.labelName")}
            value={roleLabel}
            maxLength={100}
            onChange={(e) => setRoleLabel(e.target.value)}
            error={errors.role_label}
          />
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
                  setSecrets(EMPTY);
                  setErrors({});
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
          {auth === "cookie" || auth === "header" ? (
            <TextField
              id="identity-field-name"
              label={t(`fields.${auth}Name`)}
              value={fieldName}
              maxLength={100}
              autoComplete="off"
              onChange={(e) => setFieldName(e.target.value)}
              error={errors.field_name}
            />
          ) : null}
          {sendsCredential ? (
            SECRETS[auth].map((key) => (
              <TextField
                key={key}
                id={`identity-${key}`}
                label={t(`fields.${key}`)}
                type={key === "username" ? "text" : "password"}
                autoComplete="off"
                maxLength={4096}
                value={secrets[key]}
                onChange={(e) => setSecrets((v) => ({ ...v, [key]: e.target.value }))}
                error={errors[key]}
              />
            ))
          ) : (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold">{t("fields.credential")}</span>
              <div className="flex items-center gap-2">
                <code className="border-line bg-code-bg flex-1 rounded-2xl border px-4 py-3.5 font-mono text-[15px]">
                  {t("endsIn", { last4: identity?.credential_suffix ?? "" })}
                </code>
                <Button variant="secondary" onClick={() => setReplacing(true)}>
                  {t("replace")}
                </Button>
              </div>
            </div>
          )}
          {auth === "login" ? (
            <div className="flex flex-col gap-2">
              <label htmlFor="identity-login-op" className="text-sm font-semibold">
                {t("fields.loginOperation")}
              </label>
              <select
                id="identity-login-op"
                value={loginOperation}
                onChange={(e) => setLoginOperation(e.target.value)}
                aria-invalid={errors.login_operation_id ? true : undefined}
                className={cn(inputClass, "font-mono text-sm")}
              >
                <option value="">{t("fields.chooseOperation")}</option>
                {loginCandidates.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.method} {o.path}
                  </option>
                ))}
              </select>
              {errors.login_operation_id ? (
                <span role="alert" className="text-danger text-[13px]">
                  {errors.login_operation_id}
                </span>
              ) : null}
            </div>
          ) : null}
          {auth === "login" ? (
            <span className="text-muted col-span-full text-[13.5px] leading-[1.5]">
              {t("loginNote")}
            </span>
          ) : null}
        </div>

        {identity ? (
          <div className="border-line bg-panel-2 flex flex-col gap-3 rounded-[20px] border p-5">
            <b className="text-[15px]">{t("test.title")}</b>
            <span className="text-muted text-[13.5px]">{t("test.savedOnly")}</span>
            <Button
              variant="secondary"
              className="self-start"
              onClick={() => void runTest()}
              loading={testing}
              disabled={testing || project.verification_status !== "verified"}
            >
              {testing ? null : <Icon name="refresh" size={16} />}
              {testing ? t("test.testing") : t("test.run")}
            </Button>
            {result ? (
              <div role="status" className="flex items-start gap-2.5 text-sm leading-[1.5]">
                <Icon
                  name={result.succeeded ? "check" : "alert"}
                  className={result.succeeded ? "text-success" : "text-danger"}
                  strokeWidth={2.4}
                />
                <span>
                  <b>{t("test.answered", { code: result.status_code ?? "—" })}</b>{" "}
                  <span className="text-muted">
                    {result.succeeded
                      ? t("test.okText", {
                          method: result.operation.method,
                          path: result.operation.path,
                        })
                      : t(`test.failure.${result.failure ?? "rejected"}`)}
                  </span>
                </span>
              </div>
            ) : null}
          </div>
        ) : null}

        {general ? (
          <p role="alert" className="flex items-start gap-2 text-[13.5px]">
            <Icon name="alertCircle" size={16} className="text-danger mt-0.5" />
            {general}
          </p>
        ) : null}

        <div className="border-line flex flex-wrap justify-end gap-3 border-t pt-1.5">
          <ButtonLink href={base} variant="secondary">
            {t("cancel")}
          </ButtonLink>
          <Button type="submit" loading={saving} disabled={saving}>
            {t("save")}
          </Button>
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
    </div>
  );
}

/** V-22. Agregar, editar y probar una identidad (la credencial solo viaja de ida; se ve su final). */
export function IdentityFormView({ id, identityId: editId }: { id: string; identityId?: string }) {
  const t = useTranslations("IdentityForm");
  const list = useTranslations("Identities");
  return (
    <ProjectShell
      id={id}
      trail={[
        { label: list("crumb"), href: `/projects/${id}/identities` },
        { label: editId ? t("editCrumb") : t("newCrumb") },
      ]}
      title={editId ? t("editTitle") : t("newTitle")}
      render={(project) =>
        editId ? (
          <IdentityLoader project={project} editId={editId} />
        ) : (
          <IdentityForm project={project} />
        )
      }
    />
  );
}

/** El contrato no tiene `getIdentity`: la identidad se toma de `listIdentities`. */
function IdentityLoader({ project, editId }: { project: Project; editId: string }) {
  const list = useTranslations("Identities");
  const query = useIdentities(project.id);
  return (
    <QueryState query={query} subject={list("subject")} skeleton={<FormSkeleton />}>
      {(data) => {
        const identity = data.items.find((i) => i.id === editId);
        // La anónima no se edita (`identity.anonymous`).
        if (!identity || identity.auth_type === "none") {
          return (
            <ErrorPanel code={404} standalone={false} href={`/projects/${project.id}/identities`} />
          );
        }
        return <IdentityForm key={identity.id} project={project} identity={identity} />;
      }}
    </QueryState>
  );
}
