import type { Metadata } from "next";
import { RouteParams } from "@/components/layout/route-params";
import { pageTitle } from "@/i18n/metadata";
import { IdentitiesView } from "@/features/config/identities-view";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/projects/[id]/identities">): Promise<Metadata> {
  return pageTitle(params, "identities");
}

export default function Page({ params }: PageProps<"/[locale]/projects/[id]/identities">) {
  return <RouteParams params={params}>{({ id }) => <IdentitiesView id={id} />}</RouteParams>;
}
