import type { Metadata } from "next";
import { RouteParams } from "@/components/layout/route-params";
import { pageTitle } from "@/i18n/metadata";
import { IdentityFormView } from "@/features/config/identity-form-view";
import { SEED_PROJECTS } from "@/features/projects/seed";

export function generateStaticParams() {
  return SEED_PROJECTS.flatMap((p) =>
    ["cliente-a", "cliente-b", "soporte"].map((identityId) => ({ id: p.id, identityId })),
  );
}

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
