import type { Metadata } from "next";
import { RouteParams } from "@/components/layout/route-params";
import { pageTitle } from "@/i18n/metadata";
import { ReportView } from "@/features/runs/report-view";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/projects/[id]/runs/[runId]/report">): Promise<Metadata> {
  return pageTitle(params, "report");
}

export default function Page({ params }: PageProps<"/[locale]/projects/[id]/runs/[runId]/report">) {
  return (
    <RouteParams params={params}>
      {({ id, runId }) => <ReportView id={id} runId={runId} />}
    </RouteParams>
  );
}
