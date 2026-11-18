import type { Metadata } from "next";
import { pageTitle } from "@/i18n/metadata";
import { IdentityFormView } from "@/features/config/identity-form-view";
import { SEED_PROJECTS } from "@/features/projects/seed";
import { resolveLocale } from "@/i18n/params";

export function generateStaticParams() {
  return SEED_PROJECTS.map((p) => ({ id: p.id }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/projects/[id]/identities/new">): Promise<Metadata> {
  return pageTitle(params, "identityNew");
}

export default async function Page({
  params,
}: PageProps<"/[locale]/projects/[id]/identities/new">) {
  const { id } = await params;
  await resolveLocale(params);
  return <IdentityFormView id={id} />;
}
