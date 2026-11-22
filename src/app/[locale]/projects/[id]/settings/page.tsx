import type { Metadata } from "next";
import { RouteParams } from "@/components/layout/route-params";
import { pageTitle } from "@/i18n/metadata";
import { SEED_PROJECTS } from "@/features/projects/seed";
import { SettingsView } from "@/features/projects/settings-view";

export function generateStaticParams() {
  return SEED_PROJECTS.map((p) => ({ id: p.id }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/projects/[id]/settings">): Promise<Metadata> {
  return pageTitle(params, "settings");
}

export default function ProjectSettingsPage({
  params,
}: PageProps<"/[locale]/projects/[id]/settings">) {
  return <RouteParams params={params}>{({ id }) => <SettingsView id={id} />}</RouteParams>;
}
