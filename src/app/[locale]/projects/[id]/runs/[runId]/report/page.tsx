import type { Metadata } from "next";
import { pageTitle } from "@/i18n/metadata";
import { SEED_PROJECTS } from "@/features/projects/seed";
import { ReportView } from "@/features/runs/report-view";
import { resolveLocale } from "@/i18n/params";

export function generateStaticParams() {
  return SEED_PROJECTS.flatMap((p) =>
    Array.from({ length: p.report?.runNumber ?? 0 }, (_, i) => ({
      id: p.id,
      runId: String(i + 1),
    })),
  );
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/projects/[id]/runs/[runId]/report">): Promise<Metadata> {
  return pageTitle(params, "report");
}

export default async function Page({
  params,
}: PageProps<"/[locale]/projects/[id]/runs/[runId]/report">) {
  const { id, runId } = await params;
  await resolveLocale(params);
  return <ReportView id={id} runId={runId} />;
}
