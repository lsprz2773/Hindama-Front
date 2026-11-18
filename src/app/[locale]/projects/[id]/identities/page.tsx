import type { Metadata } from "next";
import { pageTitle } from "@/i18n/metadata";
import { IdentitiesView } from "@/features/config/identities-view";
import { SEED_PROJECTS } from "@/features/projects/seed";
import { resolveLocale } from "@/i18n/params";

export function generateStaticParams() {
  return SEED_PROJECTS.map((p) => ({ id: p.id }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/projects/[id]/identities">): Promise<Metadata> {
  return pageTitle(params, "identities");
}

export default async function Page({ params }: PageProps<"/[locale]/projects/[id]/identities">) {
  const { id } = await params;
  await resolveLocale(params);
  return <IdentitiesView id={id} />;
}
