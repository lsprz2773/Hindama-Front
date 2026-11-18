import type { Metadata } from "next";
import { pageTitle } from "@/i18n/metadata";
import { ResourcesView } from "@/features/config/resources-view";
import { SEED_PROJECTS } from "@/features/projects/seed";
import { resolveLocale } from "@/i18n/params";

export function generateStaticParams() {
  return SEED_PROJECTS.map((p) => ({ id: p.id }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/projects/[id]/resources">): Promise<Metadata> {
  return pageTitle(params, "resources");
}

export default async function Page({ params }: PageProps<"/[locale]/projects/[id]/resources">) {
  const { id } = await params;
  await resolveLocale(params);
  return <ResourcesView id={id} />;
}
