import type { Metadata } from "next";
import { pageTitle } from "@/i18n/metadata";
import { StatsView } from "@/features/admin/stats-view";
import { resolveLocale } from "@/i18n/params";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin">): Promise<Metadata> {
  return pageTitle(params, "adminStats");
}

export default async function Page({ params }: PageProps<"/[locale]/admin">) {
  await resolveLocale(params);
  return <StatsView />;
}
