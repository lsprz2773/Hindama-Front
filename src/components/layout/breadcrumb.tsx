import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export interface Crumb {
  label: string;
  /** Sin `href` es la página actual. */
  href?: string;
}

/** C-02. Ruta de navegación (obligatoria en las vistas autenticadas, §9.1). */
export function Breadcrumb({ items }: { items: Crumb[] }) {
  const t = useTranslations("Breadcrumb");
  return (
    <nav aria-label={t("label")} className="text-muted flex flex-wrap gap-2 text-sm">
      {items.map((item, index) => {
        const last = index === items.length - 1;
        return (
          <span key={`${item.label}-${index}`} className="flex items-center gap-2">
            {item.href && !last ? (
              <Link href={item.href} className="text-link">
                {item.label}
              </Link>
            ) : (
              <span aria-current={last ? "page" : undefined}>{item.label}</span>
            )}
            {!last ? <span aria-hidden="true">›</span> : null}
          </span>
        );
      })}
    </nav>
  );
}
