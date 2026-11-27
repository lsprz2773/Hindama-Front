"use client";

import { useTranslations } from "next-intl";
import { useId, useState, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./icon";

export const inputClass =
  "min-h-[52px] w-full rounded-2xl border border-line-strong transition-colors duration-150 hover:border-accent/60 bg-field px-4 text-base text-fg placeholder:text-muted/80 read-only:opacity-80 disabled:opacity-50 aria-invalid:border-danger";

interface TextFieldProps extends Omit<ComponentProps<"input">, "id"> {
  label: string;
  /** Texto de ayuda bajo el campo. */
  hint?: ReactNode;
  /** Mensaje de error de validación; se muestra junto al campo (§ estados, canal Inline). */
  error?: string;
  /** Contenido a la derecha de la etiqueta (p. ej. «¿Olvidaste tu contraseña?»). */
  labelAside?: ReactNode;
  id?: string;
}

export function TextField({
  label,
  hint,
  error,
  labelAside,
  className,
  id: idProp,
  ...props
}: TextFieldProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const messageId = `${id}-msg`;
  const hasMessage = Boolean(error || hint);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-semibold">
          {label}
        </label>
        {labelAside}
      </div>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={hasMessage ? messageId : undefined}
        className={cn(inputClass, className)}
        {...props}
      />
      {hasMessage ? (
        <p
          id={messageId}
          role={error ? "alert" : undefined}
          className={cn("flex items-start gap-2 text-[13.5px]", error ? "text-fg" : "text-muted")}
        >
          {error ? <Icon name="alertCircle" size={16} className="text-danger mt-0.5" /> : null}
          <span>{error ?? hint}</span>
        </p>
      ) : null}
    </div>
  );
}

/** Campo de contraseña con botón de mostrar/ocultar. */
export function PasswordField({ className, ...props }: Omit<TextFieldProps, "type">) {
  const t = useTranslations("Fields");
  const [visible, setVisible] = useState(false);
  const toggleId = useId();

  return (
    <div className="relative">
      <TextField
        {...props}
        type={visible ? "text" : "password"}
        className={cn("pr-14", className)}
      />
      <button
        id={toggleId}
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-pressed={visible}
        aria-label={visible ? t("hidePassword") : t("showPassword")}
        className="text-muted hover:text-fg absolute top-[30px] right-2 inline-flex size-11 items-center justify-center rounded-xl"
      >
        <Icon name={visible ? "eyeOff" : "eye"} size={20} />
      </button>
    </div>
  );
}
