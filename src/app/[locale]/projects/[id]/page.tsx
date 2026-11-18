import { DashboardView } from "@/features/projects/dashboard-view";
import { SEED_PROJECTS } from "@/features/projects/seed";
import { resolveLocale } from "@/i18n/params";

export function generateStaticParams() {
  return SEED_PROJECTS.map((p) => ({ id: p.id }));
}

export default async function ProjectDashboardPage({
  params,
}: PageProps<"/[locale]/projects/[id]">) {
  const { id } = await params;
  await resolveLocale(params);
  return <DashboardView id={id} />;
}
