import type { Metadata } from "next";
import { RouteParams } from "@/components/layout/route-params";
import { pageTitle } from "@/i18n/metadata";
import { VersionsView } from "@/features/config/versions-view";
import { SEED_PROJECTS } from "@/features/projects/seed";

export function generateStaticParams() {
  return SEED_PROJECTS.map((p) => ({ id: p.id }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/projects/[id]/contract/versions">): Promise<Metadata> {
  return pageTitle(params, "versions");
}

export default function Page({ params }: PageProps<"/[locale]/projects/[id]/contract/versions">) {
  return <RouteParams params={params}>{({ id }) => <VersionsView id={id} />}</RouteParams>;
}
