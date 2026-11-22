import type { Metadata } from "next";
import { RouteParams } from "@/components/layout/route-params";
import { pageTitle } from "@/i18n/metadata";
import { IdentityFormView } from "@/features/config/identity-form-view";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/projects/[id]/identities/[identityId]">): Promise<Metadata> {
  return pageTitle(params, "identityEdit");
}

export default function Page({
  params,
}: PageProps<"/[locale]/projects/[id]/identities/[identityId]">) {
  return (
    <RouteParams params={params}>
      {({ id, identityId }) => <IdentityFormView id={id} identityId={identityId} />}
    </RouteParams>
  );
}
