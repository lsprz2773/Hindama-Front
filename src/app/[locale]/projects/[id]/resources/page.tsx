import type { Metadata } from "next";
import { RouteParams } from "@/components/layout/route-params";
import { pageTitle } from "@/i18n/metadata";
import { ResourcesView } from "@/features/config/resources-view";
import { SEED_PROJECTS } from "@/features/projects/seed";

export function generateStaticParams() {
  return SEED_PROJECTS.map((p) => ({ id: p.id }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/projects/[id]/resources">): Promise<Metadata> {
  return pageTitle(params, "resources");
}

export default function Page({ params }: PageProps<"/[locale]/projects/[id]/resources">) {
  return <RouteParams params={params}>{({ id }) => <ResourcesView id={id} />}</RouteParams>;
}
