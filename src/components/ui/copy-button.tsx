"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type ComponentProps } from "react";
import { Button } from "./button";
import { Icon } from "./icon";
import { useToast } from "./toast";

interface CopyButtonProps extends Omit<ComponentProps<typeof Button>, "onClick" | "children"> {
  /** Texto que va al portapapeles. */
  value: string;
  /** Texto del botón; por defecto «Copiar». */
  label?: string;
  /** Texto accesible cuando el botón solo dice «Copiar» (qué se copia). */
  what?: string;
}

/** Copiar al portapapeles: el icono cambia 2 s al copiar y se avisa con un toast (error si falla). */
export function CopyButton({
  value,
  label,
  what,
  variant = "secondary",
  ...props
}: CopyButtonProps) {
  const t = useTranslations("Copy");
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 2000);
      toast.show({ type: "success", title: t("copied"), duration: 2500 });
    } catch {
      toast.show({ type: "error", title: t("failed"), text: t("failedText") });
    }
  }

  const text = label ?? t("copy");
  return (
    <Button
      variant={variant}
      onClick={copy}
      aria-label={what ? t("copyWhat", { what }) : undefined}
      {...props}
    >
      <Icon name={copied ? "check" : "copy"} size={16} />
      {copied ? t("copied") : text}
    </Button>
  );
}
