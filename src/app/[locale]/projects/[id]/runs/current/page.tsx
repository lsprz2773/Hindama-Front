import type { Metadata } from "next";
import { RouteParams } from "@/components/layout/route-params";
import { pageTitle } from "@/i18n/metadata";
import { RunProgressView } from "@/features/runs/run-progress-view";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/projects/[id]/runs/current">): Promise<Metadata> {
  return pageTitle(params, "runCurrent");
}

export default function Page({ params }: PageProps<"/[locale]/projects/[id]/runs/current">) {
  return <RouteParams params={params}>{({ id }) => <RunProgressView id={id} />}</RouteParams>;
}
