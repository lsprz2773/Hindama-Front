import type { Metadata } from "next";
import { pageTitle } from "@/i18n/metadata";
import { DashboardView } from "@/features/projects/dashboard-view";
import { SEED_PROJECTS } from "@/features/projects/seed";
import { resolveLocale } from "@/i18n/params";

export function generateStaticParams() {
  return SEED_PROJECTS.map((p) => ({ id: p.id }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/projects/[id]">): Promise<Metadata> {
  return pageTitle(params, "dashboard");
}

export default async function ProjectDashboardPage({
  params,
}: PageProps<"/[locale]/projects/[id]">) {
  const { id } = await params;
  await resolveLocale(params);
  return <DashboardView id={id} />;
}
