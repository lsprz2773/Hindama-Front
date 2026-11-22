import type { Metadata } from "next";
import { RouteParams } from "@/components/layout/route-params";
import { pageTitle } from "@/i18n/metadata";
import { SEED_PROJECTS } from "@/features/projects/seed";
import { FindingDetailView } from "@/features/runs/finding-detail-view";
import { SEED_FINDINGS } from "@/features/runs/data";

export function generateStaticParams() {
  return SEED_PROJECTS.flatMap((p) =>
    p.id === "pedidos" ? SEED_FINDINGS.map((f) => ({ id: p.id, findingId: f.id })) : [],
  );
}

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
