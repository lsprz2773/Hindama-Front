import type { Metadata } from "next";
import { RouteParams } from "@/components/layout/route-params";
import { pageTitle } from "@/i18n/metadata";
import { PolicyView } from "@/features/config/policy-view";
import { SEED_PROJECTS } from "@/features/projects/seed";

export function generateStaticParams() {
  return SEED_PROJECTS.map((p) => ({ id: p.id }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/projects/[id]/policy">): Promise<Metadata> {
  return pageTitle(params, "policy");
}

export default function Page({ params }: PageProps<"/[locale]/projects/[id]/policy">) {
  return <RouteParams params={params}>{({ id }) => <PolicyView id={id} />}</RouteParams>;
}
