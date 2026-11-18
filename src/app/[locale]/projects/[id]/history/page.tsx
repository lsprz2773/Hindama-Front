import { SEED_PROJECTS } from "@/features/projects/seed";
import { HistoryView } from "@/features/runs/history-view";
import { resolveLocale } from "@/i18n/params";

export function generateStaticParams() {
  return SEED_PROJECTS.map((p) => ({ id: p.id }));
}

export default async function Page({ params }: PageProps<"/[locale]/projects/[id]/history">) {
  const { id } = await params;
  await resolveLocale(params);
  return <HistoryView id={id} />;
}
