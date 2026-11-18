import type { Metadata } from "next";
import { pageTitle } from "@/i18n/metadata";
import { SEED_PROJECTS } from "@/features/projects/seed";
import { HistoryView } from "@/features/runs/history-view";
import { resolveLocale } from "@/i18n/params";

export function generateStaticParams() {
  return SEED_PROJECTS.map((p) => ({ id: p.id }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/projects/[id]/history">): Promise<Metadata> {
  return pageTitle(params, "history");
}

export default async function Page({ params }: PageProps<"/[locale]/projects/[id]/history">) {
  const { id } = await params;
  await resolveLocale(params);
  return <HistoryView id={id} />;
}
