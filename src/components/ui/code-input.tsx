"use client";

import { useTranslations } from "next-intl";
import { useId, useRef, type ClipboardEvent, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./icon";
import { inputClass } from "./text-field";

interface CodeInputProps {
  /** Texto de la leyenda del grupo (p. ej. «Código de verificación»). */
  legend: string;
  value: string;
  onChange: (value: string) => void;
  length?: number;
  error?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}

/** Código de N dígitos en cajas separadas: avanza solo, admite pegar y borrar hacia atrás. */
export function CodeInput({
  legend,
  value,
  onChange,
  length = 6,
  error,
  disabled,
  autoFocus,
}: CodeInputProps) {
  const t = useTranslations("Fields");
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const messageId = useId();
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");

  function focusAt(index: number) {
    refs.current[Math.max(0, Math.min(length - 1, index))]?.focus();
  }

  function setDigit(index: number, raw: string) {
    const clean = raw.replace(/\D/g, "");
    if (!clean) {
      onChange(
        digits
          .map((d, i) => (i === index ? "" : d))
          .join("")
          .slice(0, length),
      );
      return;
    }
    // Si se escriben o pegan varios dígitos, se reparten desde la caja actual.
    const next = [...digits];
    clean
      .slice(0, length - index)
      .split("")
      .forEach((d, k) => {
        next[index + k] = d;
      });
    onChange(next.join("").slice(0, length));
    focusAt(index + clean.length);
  }

  function onKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      event.preventDefault();
      onChange(digits.map((d, i) => (i === index - 1 ? "" : d)).join(""));
      focusAt(index - 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusAt(index - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      focusAt(index + 1);
    }
  }

  function onPaste(index: number, event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    setDigit(index, event.clipboardData.getData("text"));
  }

  return (
    <fieldset
      className="m-0 flex flex-col gap-2 border-0 p-0"
      aria-describedby={error ? messageId : undefined}
    >
      <legend className="mb-2 p-0 text-sm font-semibold">{legend}</legend>
      <div
        className="grid gap-2.5"
        style={{ gridTemplateColumns: `repeat(${length}, minmax(0, 1fr))` }}
      >
        {digits.map((digit, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={length}
            autoComplete={i === 0 ? "one-time-code" : "off"}
            autoFocus={autoFocus && i === 0}
            aria-label={t("digit", { index: i + 1, total: length })}
            aria-invalid={error ? true : undefined}
            disabled={disabled}
            value={digit}
            onChange={(e) => setDigit(i, e.target.value)}
            onKeyDown={(e) => onKeyDown(i, e)}
            onPaste={(e) => onPaste(i, e)}
            onFocus={(e) => e.target.select()}
            className={cn(inputClass, "min-h-[60px] min-w-0 px-0 text-center font-mono text-2xl")}
          />
        ))}
      </div>
      {error ? (
        <p id={messageId} role="alert" className="flex items-start gap-2 text-[13.5px]">
          <Icon name="alertCircle" size={16} className="text-danger mt-0.5" />
          <span>{error}</span>
        </p>
      ) : null}
    </fieldset>
  );
}
