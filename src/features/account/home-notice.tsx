"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { setHomeNotice, useHomeNotice } from "./notice";

/**
 * Aviso al llegar a la página de inicio tras cerrar sesión solo en este navegador (el BFF borró
 * la cookie pero Cognito no confirmó la revocación): un toast al llegar y un banner que se queda
 * hasta cerrarlo (catálogo de estados).
 */
export function HomeNotice() {
  const t = useTranslations("HomeNotice");
  const toast = useToast();
  const notice = useHomeNotice();
  const announced = useRef<string | null>(null);

  useEffect(() => {
    if (!notice || announced.current === notice) return;
    announced.current = notice;
    toast.show({
      type: "warning",
      title: t(`${notice}.title`),
      duration: 0,
    });
  }, [notice, toast, t]);

  if (notice !== "local_sign_out") return null;

  return (
    <Banner
      tone="warning"
      title={t(`${notice}.title`)}
      action={
        <Button variant="ghost" size="sm" onClick={() => setHomeNotice(null)}>
          {t("dismiss")}
        </Button>
      }
    >
      {t(`${notice}.text`)}
    </Banner>
  );
}
