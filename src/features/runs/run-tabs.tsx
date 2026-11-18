import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

export type RunTab = "summary" | "matrix" | "findings";

/** Pestañas de una ejecución: Resumen · Matriz de acceso · Hallazgos. Cada una es su propia ruta. */
export function RunTabs({
  base,
  run,
  active,
  findings,
}: {
  base: string;
  run: number;
  active: RunTab;
  findings: number;
}) {
  const t = useTranslations("RunTabs");
  const tabs: { key: RunTab; label: string; href: string }[] = [
    { key: "summary", label: t("summary"), href: `${base}/runs/${run}` },
    { key: "matrix", label: t("matrix"), href: `${base}/runs/${run}/matrix` },
    { key: "findings", label: t("findings", { count: findings }), href: `${base}/findings` },
  ];
  return (
    <div
      role="tablist"
      aria-label={t("label")}
      className="border-line bg-panel-2 inline-flex flex-wrap gap-1 rounded-2xl border p-1"
    >
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          role="tab"
          aria-selected={tab.key === active}
          className={cn(
            "inline-flex min-h-10 items-center rounded-xl px-4 text-sm font-semibold no-underline",
            tab.key === active ? "bg-accent text-on-accent" : "text-fg",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
