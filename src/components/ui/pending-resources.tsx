import { useTranslations } from "next-intl";

export interface PendingResource {
  operation: string;
  location: string;
  attempts: number;
  maxAttempts?: number;
  /** Último error, siempre sin credenciales. */
  lastError: string;
}

/**
 * C-15. Recursos que la plataforma creó en la API del analista y no pudo borrar tras 3 intentos.
 * El analista debe eliminarlos a mano (CU-23 E1, RN-06).
 */
export function PendingResources({ resources }: { resources: PendingResource[] }) {
  const t = useTranslations("PendingResources");
  if (resources.length === 0) return null;

  return (
    <section
      aria-labelledby="pending-resources-h"
      role="status"
      className="border-line bg-panel border-l-warning flex flex-col gap-[18px] rounded-[28px] border border-l-4 px-7 py-[26px] backdrop-blur-lg"
    >
      <div className="flex items-start gap-4">
        <span
          aria-hidden="true"
          className="bg-warning-bg text-warning inline-flex size-11 flex-none items-center justify-center rounded-[14px]"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />
          </svg>
        </span>
        <div className="flex min-w-0 flex-col gap-1.5">
          <h2 id="pending-resources-h" className="text-lg font-semibold">
            {t("title", { count: resources.length })}
          </h2>
          <p className="text-muted max-w-[70ch] text-[14.5px] leading-[1.55]">{t("text")}</p>
        </div>
      </div>

      <div className="border-line bg-panel-2 overflow-x-auto rounded-[20px] border">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <caption className="sr-only">{t("tableLabel")}</caption>
          <thead>
            <tr className="text-muted border-line border-b text-[12.5px]">
              <th scope="col" className="px-[18px] py-3 font-bold">
                {t("operation")}
              </th>
              <th scope="col" className="px-[18px] py-3 font-bold">
                {t("location")}
              </th>
              <th scope="col" className="px-[18px] py-3 font-bold">
                {t("attempts")}
              </th>
              <th scope="col" className="px-[18px] py-3 font-bold">
                {t("lastError")}
              </th>
            </tr>
          </thead>
          <tbody>
            {resources.map((r) => (
              <tr
                key={`${r.operation}${r.location}`}
                className="border-line border-b last:border-b-0"
              >
                <td className="px-[18px] py-3.5 font-mono text-[13px]">{r.operation}</td>
                <td className="px-[18px] py-3.5 font-mono text-[13px] break-words">{r.location}</td>
                <td className="px-[18px] py-3.5">
                  {t("attemptsOf", { done: r.attempts, total: r.maxAttempts ?? 3 })}
                </td>
                <td className="text-muted px-[18px] py-3.5">{r.lastError}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
