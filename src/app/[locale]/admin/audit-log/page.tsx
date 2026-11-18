import { AuditLogView } from "@/features/admin/audit-log-view";
import { resolveLocale } from "@/i18n/params";

export default async function Page({ params }: PageProps<"/[locale]/admin/audit-log">) {
  await resolveLocale(params);
  return <AuditLogView />;
}
