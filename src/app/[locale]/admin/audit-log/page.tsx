import type { Metadata } from "next";
import { pageTitle } from "@/i18n/metadata";
import { AuditLogView } from "@/features/admin/audit-log-view";
import { resolveLocale } from "@/i18n/params";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/audit-log">): Promise<Metadata> {
  return pageTitle(params, "auditLog");
}

export default async function Page({ params }: PageProps<"/[locale]/admin/audit-log">) {
  await resolveLocale(params);
  return <AuditLogView />;
}
