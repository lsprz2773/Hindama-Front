import type { Metadata } from "next";
import { RouteParams } from "@/components/layout/route-params";
import { pageTitle } from "@/i18n/metadata";
import { FindingDetailView } from "@/features/runs/finding-detail-view";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/projects/[id]/findings/[findingId]">): Promise<Metadata> {
  return pageTitle(params, "finding");
}

export default function Page({
  params,
}: PageProps<"/[locale]/projects/[id]/findings/[findingId]">) {
  return (
    <RouteParams params={params}>
      {({ id, findingId }) => <FindingDetailView id={id} findingId={findingId} />}
    </RouteParams>
  );
}
