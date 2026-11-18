import type { Metadata } from "next";
import { pageTitle } from "@/i18n/metadata";
import { ContractView } from "@/features/config/contract-view";
import { SEED_PROJECTS } from "@/features/projects/seed";
import { resolveLocale } from "@/i18n/params";

export function generateStaticParams() {
  return SEED_PROJECTS.map((p) => ({ id: p.id }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/projects/[id]/contract">): Promise<Metadata> {
  return pageTitle(params, "contract");
}

export default async function Page({ params }: PageProps<"/[locale]/projects/[id]/contract">) {
  const { id } = await params;
  await resolveLocale(params);
  return <ContractView id={id} />;
}
