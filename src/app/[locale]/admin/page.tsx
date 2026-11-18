import { StatsView } from "@/features/admin/stats-view";
import { resolveLocale } from "@/i18n/params";

export default async function Page({ params }: PageProps<"/[locale]/admin">) {
  await resolveLocale(params);
  return <StatsView />;
}
