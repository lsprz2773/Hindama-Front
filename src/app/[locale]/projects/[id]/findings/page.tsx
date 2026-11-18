import { SEED_PROJECTS } from "@/features/projects/seed";
import { FindingsView } from "@/features/runs/findings-view";
import { resolveLocale } from "@/i18n/params";

export function generateStaticParams() {
  return SEED_PROJECTS.map((p) => ({ id: p.id }));
}

export default async function Page({ params }: PageProps<"/[locale]/projects/[id]/findings">) {
  const { id } = await params;
  await resolveLocale(params);
  return <FindingsView id={id} />;
}
