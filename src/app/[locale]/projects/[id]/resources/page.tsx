import type { Metadata } from "next";
import { RouteParams } from "@/components/layout/route-params";
import { pageTitle } from "@/i18n/metadata";
import { ResourcesView } from "@/features/config/resources-view";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/projects/[id]/resources">): Promise<Metadata> {
  return pageTitle(params, "resources");
}

export default function Page({ params }: PageProps<"/[locale]/projects/[id]/resources">) {
  return <RouteParams params={params}>{({ id }) => <ResourcesView id={id} />}</RouteParams>;
}
