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

export default async function Page({
  params,
}: PageProps<"/[locale]/projects/[id]/runs/[runId]/matrix">) {
  const { id, runId } = await params;
  await resolveLocale(params);
  return <MatrixView id={id} runId={runId} />;
}
