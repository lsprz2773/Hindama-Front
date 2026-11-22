import type { Metadata } from "next";
import { RouteParams } from "@/components/layout/route-params";
import { pageTitle } from "@/i18n/metadata";
import { IdentityFormView } from "@/features/config/identity-form-view";
import { SEED_PROJECTS } from "@/features/projects/seed";

export function generateStaticParams() {
  return SEED_PROJECTS.map((p) => ({ id: p.id }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/projects/[id]/identities/new">): Promise<Metadata> {
  return pageTitle(params, "identityNew");
}

export default function Page({ params }: PageProps<"/[locale]/projects/[id]/identities/new">) {
  return <RouteParams params={params}>{({ id }) => <IdentityFormView id={id} />}</RouteParams>;
}
