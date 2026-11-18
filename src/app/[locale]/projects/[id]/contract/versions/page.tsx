import { VersionsView } from "@/features/config/versions-view";
import { SEED_PROJECTS } from "@/features/projects/seed";
import { resolveLocale } from "@/i18n/params";

export function generateStaticParams() {
  return SEED_PROJECTS.map((p) => ({ id: p.id }));
}

export default async function Page({
  params,
}: PageProps<"/[locale]/projects/[id]/contract/versions">) {
  const { id } = await params;
  await resolveLocale(params);
  return <VersionsView id={id} />;
}
