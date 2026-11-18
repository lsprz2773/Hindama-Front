import { SEED_PROJECTS } from "@/features/projects/seed";
import { FindingDetailView } from "@/features/runs/finding-detail-view";
import { SEED_FINDINGS } from "@/features/runs/data";
import { resolveLocale } from "@/i18n/params";

export function generateStaticParams() {
  return SEED_PROJECTS.flatMap((p) =>
    p.id === "pedidos" ? SEED_FINDINGS.map((f) => ({ id: p.id, findingId: f.id })) : [],
  );
}

export default async function Page({
  params,
}: PageProps<"/[locale]/projects/[id]/findings/[findingId]">) {
  const { id, findingId } = await params;
  await resolveLocale(params);
  return <FindingDetailView id={id} findingId={findingId} />;
}
