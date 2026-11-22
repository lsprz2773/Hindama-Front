import type { Metadata } from "next";
import { RouteParams } from "@/components/layout/route-params";
import { pageTitle } from "@/i18n/metadata";
import { IdentityFormView } from "@/features/config/identity-form-view";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/projects/[id]/identities/new">): Promise<Metadata> {
  return pageTitle(params, "identityNew");
}

export default function Page({ params }: PageProps<"/[locale]/projects/[id]/identities/new">) {
  return <RouteParams params={params}>{({ id }) => <IdentityFormView id={id} />}</RouteParams>;
}
