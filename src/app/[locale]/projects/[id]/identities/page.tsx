import type { Metadata } from "next";
import { RouteParams } from "@/components/layout/route-params";
import { pageTitle } from "@/i18n/metadata";
import { IdentitiesView } from "@/features/config/identities-view";
import { SEED_PROJECTS } from "@/features/projects/seed";

export function generateStaticParams() {
  return SEED_PROJECTS.map((p) => ({ id: p.id }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/projects/[id]/identities">): Promise<Metadata> {
  return pageTitle(params, "identities");
}

export default function Page({ params }: PageProps<"/[locale]/projects/[id]/identities">) {
  return <RouteParams params={params}>{({ id }) => <IdentitiesView id={id} />}</RouteParams>;
}
