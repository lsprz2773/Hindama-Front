import type { Metadata } from "next";
import { RouteParams } from "@/components/layout/route-params";
import { pageTitle } from "@/i18n/metadata";
import { PolicyView } from "@/features/config/policy-view";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/projects/[id]/policy">): Promise<Metadata> {
  return pageTitle(params, "policy");
}

export default function Page({ params }: PageProps<"/[locale]/projects/[id]/policy">) {
  return <RouteParams params={params}>{({ id }) => <PolicyView id={id} />}</RouteParams>;
}
