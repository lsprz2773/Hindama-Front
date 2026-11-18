import type { Metadata } from "next";
import { pageTitle } from "@/i18n/metadata";
import { SEED_PROJECTS } from "@/features/projects/seed";
import { MatrixView } from "@/features/runs/matrix-view";
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
}: PageProps<"/[locale]/projects/[id]/runs/[runId]/matrix">): Promise<Metadata> {
  return pageTitle(params, "matrix");
}

export default async function Page({
  params,
}: PageProps<"/[locale]/projects/[id]/runs/[runId]/matrix">) {
  const { id, runId } = await params;
  await resolveLocale(params);
  return <MatrixView id={id} runId={runId} />;
}
