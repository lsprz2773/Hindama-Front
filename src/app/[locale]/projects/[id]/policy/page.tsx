import type { Metadata } from "next";
import { pageTitle } from "@/i18n/metadata";
import { PolicyView } from "@/features/config/policy-view";
import { SEED_PROJECTS } from "@/features/projects/seed";
import { resolveLocale } from "@/i18n/params";

export function generateStaticParams() {
  return SEED_PROJECTS.map((p) => ({ id: p.id }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/projects/[id]/policy">): Promise<Metadata> {
  return pageTitle(params, "policy");
}

export default async function Page({ params }: PageProps<"/[locale]/projects/[id]/policy">) {
  const { id } = await params;
  await resolveLocale(params);
  return <PolicyView id={id} />;
}
