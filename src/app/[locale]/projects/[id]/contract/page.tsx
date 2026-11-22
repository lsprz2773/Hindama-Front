import type { Metadata } from "next";
import { RouteParams } from "@/components/layout/route-params";
import { pageTitle } from "@/i18n/metadata";
import { ContractView } from "@/features/config/contract-view";
import { SEED_PROJECTS } from "@/features/projects/seed";

export function generateStaticParams() {
  return SEED_PROJECTS.map((p) => ({ id: p.id }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/projects/[id]/contract">): Promise<Metadata> {
  return pageTitle(params, "contract");
}

export default function Page({ params }: PageProps<"/[locale]/projects/[id]/contract">) {
  return <RouteParams params={params}>{({ id }) => <ContractView id={id} />}</RouteParams>;
}
