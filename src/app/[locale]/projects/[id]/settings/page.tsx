import { SEED_PROJECTS } from "@/features/projects/seed";
import { SettingsView } from "@/features/projects/settings-view";
import { resolveLocale } from "@/i18n/params";

export function generateStaticParams() {
  return SEED_PROJECTS.map((p) => ({ id: p.id }));
}

export default async function ProjectSettingsPage({
  params,
}: PageProps<"/[locale]/projects/[id]/settings">) {
  const { id } = await params;
  await resolveLocale(params);
  return <SettingsView id={id} />;
}
