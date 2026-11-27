import type { Metadata } from "next";
import { RouteParams } from "@/components/layout/route-params";
import { pageTitle } from "@/i18n/metadata";
import { MatrixView } from "@/features/runs/matrix-view";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/projects/[id]/runs/[runId]/matrix">): Promise<Metadata> {
  return pageTitle(params, "matrix");
}

export default function Page({ params }: PageProps<"/[locale]/projects/[id]/runs/[runId]/matrix">) {
  return (
    <RouteParams params={params}>
      {({ id, runId }) => <MatrixView id={id} runId={runId} />}
    </RouteParams>
  );
}
