"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { Banner } from "./banner";
import { useToast } from "./toast";

function subscribe(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

/** `false` solo cuando el navegador informa que no hay red; en el servidor se asume conectado. */
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}

/**
 * Banner «Sin conexión. Reconectando…» (catálogo de estados): se queda mientras no haya red y,
 * al volver, avisa con un toast de que los datos se actualizaron.
 */
export function OfflineBanner() {
  const t = useTranslations("Offline");
  const toast = useToast();
  const online = useOnline();
  const wasOffline = useRef(false);

  useEffect(() => {
    if (!online) wasOffline.current = true;
    else if (wasOffline.current) {
      wasOffline.current = false;
      toast.show({ type: "success", title: t("back"), text: t("backText") });
    }
  }, [online, t, toast]);

  if (online) return null;
  return (
    <Banner tone="warning" icon="refresh" title={t("title")}>
      {t("text")}
    </Banner>
  );
}
