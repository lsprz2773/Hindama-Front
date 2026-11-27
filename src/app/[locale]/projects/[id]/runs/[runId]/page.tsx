import type { Metadata } from "next";
import { RouteParams } from "@/components/layout/route-params";
import { pageTitle } from "@/i18n/metadata";
import { RunResultsView } from "@/features/runs/run-results-view";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/projects/[id]/runs/[runId]">): Promise<Metadata> {
  return pageTitle(params, "runResults");
}

export default function Page({ params }: PageProps<"/[locale]/projects/[id]/runs/[runId]">) {
  return (
    <RouteParams params={params}>
      {({ id, runId }) => <RunResultsView id={id} runId={runId} />}
    </RouteParams>
  );
}
