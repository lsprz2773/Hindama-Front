import type { Metadata } from "next";
import { RouteParams } from "@/components/layout/route-params";
import { pageTitle } from "@/i18n/metadata";
import { ConfigureRunView } from "@/features/runs/configure-run-view";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/projects/[id]/runs/new">): Promise<Metadata> {
  return pageTitle(params, "runNew");
}

export default function Page({ params }: PageProps<"/[locale]/projects/[id]/runs/new">) {
  return <RouteParams params={params}>{({ id }) => <ConfigureRunView id={id} />}</RouteParams>;
}
