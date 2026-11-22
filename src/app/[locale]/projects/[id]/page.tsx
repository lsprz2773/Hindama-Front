import type { Metadata } from "next";
import { RouteParams } from "@/components/layout/route-params";
import { pageTitle } from "@/i18n/metadata";
import { DashboardView } from "@/features/projects/dashboard-view";
import { SEED_PROJECTS } from "@/features/projects/seed";

export function generateStaticParams() {
  return SEED_PROJECTS.map((p) => ({ id: p.id }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/projects/[id]">): Promise<Metadata> {
  return pageTitle(params, "dashboard");
}

export default function ProjectDashboardPage({ params }: PageProps<"/[locale]/projects/[id]">) {
  return <RouteParams params={params}>{({ id }) => <DashboardView id={id} />}</RouteParams>;
}
