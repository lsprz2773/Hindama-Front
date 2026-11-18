import { IdentityFormView } from "@/features/config/identity-form-view";
import { SEED_PROJECTS } from "@/features/projects/seed";
import { resolveLocale } from "@/i18n/params";

export function generateStaticParams() {
  return SEED_PROJECTS.flatMap((p) =>
    ["cliente-a", "cliente-b", "soporte"].map((identityId) => ({ id: p.id, identityId })),
  );
}

export default async function Page({
  params,
}: PageProps<"/[locale]/projects/[id]/identities/[identityId]">) {
  const { id, identityId } = await params;
  await resolveLocale(params);
  return <IdentityFormView id={id} identityId={identityId} />;
}
