import { SEED_PROJECTS } from "@/features/projects/seed";
import { RunResultsView } from "@/features/runs/run-results-view";
import { resolveLocale } from "@/i18n/params";

export function generateStaticParams() {
  return SEED_PROJECTS.flatMap((p) =>
    Array.from({ length: p.report?.runNumber ?? 0 }, (_, i) => ({
      id: p.id,
      runId: String(i + 1),
    })),
  );
}

export default async function Page({ params }: PageProps<"/[locale]/projects/[id]/runs/[runId]">) {
  const { id, runId } = await params;
  await resolveLocale(params);
  return <RunResultsView id={id} runId={runId} />;
}
