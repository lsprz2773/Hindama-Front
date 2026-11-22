import { useTranslations } from "next-intl";
import type { ApiWarning } from "@/lib/http";
import { Banner, type BannerTone } from "./banner";

/**
 * Avisos que devuelve la API (`warnings[].code`). La API entrega el código y la interfaz
 * elige el texto. Los persistentes vuelven mientras la condición siga; los momentáneos solo
 * llegan en la respuesta que los causó.
 */
export const WARNING_CODES = {
  "url.no_tls": { tone: "warning", persistent: true },
  "url.unresolved": { tone: "info", persistent: false },
  "project.verification_lost": { tone: "warning", persistent: false },
  "contract.servers_mismatch": { tone: "warning", persistent: false },
  "contract.external_reference": { tone: "warning", persistent: false },
  "contract.unparsed_element": { tone: "warning", persistent: false },
  "contract.unchanged": { tone: "info", persistent: false },
} as const satisfies Record<string, { tone: BannerTone; persistent: boolean }>;

export type KnownWarningCode = keyof typeof WARNING_CODES;

export function isKnownWarning(code: string): code is KnownWarningCode {
  return code in WARNING_CODES;
}

/** Clave de mensajes: `url.no_tls` → `url_no_tls`. */
function messageKey(code: KnownWarningCode) {
  return code.replace(/\./g, "_") as never;
}

/** Un aviso tal como llega de la API; las vistas de ejemplo pueden pasar solo el `code`. */
type WarningInput = Pick<ApiWarning, "code"> & Partial<Omit<ApiWarning, "code">>;

interface ApiWarningsProps {
  warnings: WarningInput[];
  /** Si se indica, solo se muestran estos códigos (cada vista elige los suyos). */
  only?: KnownWarningCode[];
  className?: string;
}

/** C-16 (y C-11, el aviso de HTTP sin cifrar). Texto del contrato siempre escapado. */
export function ApiWarnings({ warnings, only, className }: ApiWarningsProps) {
  const t = useTranslations("Warnings");
  const visible = warnings.filter(
    (w): w is WarningInput & { code: KnownWarningCode } =>
      isKnownWarning(w.code) && (!only || only.includes(w.code)),
  );
  if (visible.length === 0) return null;

  return (
    <ul className={`m-0 flex list-none flex-col gap-3 p-0 ${className ?? ""}`}>
      {visible.map((w, index) => {
        const key = messageKey(w.code);
        const config = WARNING_CODES[w.code];
        return (
          <li key={`${w.code}:${w.location ?? index}`}>
            <Banner
              tone={config.tone}
              title={t(`${key}.title` as never)}
              tag={config.persistent ? t("persistent") : t("momentary")}
            >
              {t(`${key}.text` as never)}
              {w.location || w.message ? (
                <code className="bg-track text-fg mt-1.5 block max-w-full self-start rounded-[10px] px-2.5 py-1.5 font-mono text-[12.5px] break-words">
                  {/* En avisos del contrato, `location` es un JSON Pointer dentro del documento. */}
                  {w.location ?? w.message}
                </code>
              ) : null}
            </Banner>
          </li>
        );
      })}
    </ul>
  );
}
