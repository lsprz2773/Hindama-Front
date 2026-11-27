"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ConfirmDialog } from "./confirm-dialog";

/**
 * Pide confirmación antes de salir con cambios sin guardar (C-06): intercepta los enlaces
 * internos de la página y avisa al navegador al cerrar o recargar la pestaña.
 */
export function UnsavedChangesGuard({ dirty, items }: { dirty: boolean; items?: string[] }) {
  const t = useTranslations("Dialogs.unsaved");
  const router = useRouter();
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.(
        "a[href]",
      ) as HTMLAnchorElement | null;
      if (
        !anchor ||
        anchor.target === "_blank" ||
        anchor.closest("[role=dialog],[role=alertdialog]")
      )
        return;
      const href = anchor.getAttribute("href") ?? "";
      if (!href.startsWith("/") || href.startsWith("//") || href.startsWith("/#")) return;
      event.preventDefault();
      event.stopPropagation();
      setTarget(href);
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);

  return (
    <ConfirmDialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) setTarget(null);
      }}
      title={t("title")}
      description={t("text")}
      consequences={items?.length ? { heading: t("heading"), items } : undefined}
      cancelLabel={t("stay")}
      confirmLabel={t("leave")}
      onConfirm={async () => {
        const href = target;
        setTarget(null);
        if (href) router.push(href);
      }}
    />
  );
}
