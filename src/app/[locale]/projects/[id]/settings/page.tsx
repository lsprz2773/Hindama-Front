import type { Metadata } from "next";
import { RouteParams } from "@/components/layout/route-params";
import { pageTitle } from "@/i18n/metadata";
import { SettingsView } from "@/features/projects/settings-view";

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
