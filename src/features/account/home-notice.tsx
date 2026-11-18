"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { NOTICE_KEY, useFlag, writeFlag, type HomeNotice as Notice } from "./browser-store";

/**
 * Aviso al llegar a la página de inicio tras eliminar la cuenta o cerrar sesión solo en este
 * navegador: un toast al llegar y un banner que se queda hasta cerrarlo (catálogo de estados).
 */
export function HomeNotice() {
  const t = useTranslations("HomeNotice");
  const toast = useToast();
  const notice = useFlag(NOTICE_KEY) as Notice | null;
  const announced = useRef<string | null>(null);

  useEffect(() => {
    if (!notice || announced.current === notice) return;
    announced.current = notice;
    toast.show({
      type: notice === "account_deleted" ? "success" : "warning",
      title: t(`${notice}.title`),
      duration: notice === "account_deleted" ? 8000 : 0,
    });
  }, [notice, toast, t]);

  if (notice !== "account_deleted" && notice !== "local_sign_out") return null;

  return (
    <Banner
      tone={notice === "account_deleted" ? "success" : "warning"}
      title={t(`${notice}.title`)}
      action={
        <Button variant="ghost" size="sm" onClick={() => writeFlag(NOTICE_KEY, null)}>
          {t("dismiss")}
        </Button>
      }
    >
      {t(`${notice}.text`)}
    </Banner>
  );
}
