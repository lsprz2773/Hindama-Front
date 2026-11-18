import type { Metadata } from "next";
import { pageTitle } from "@/i18n/metadata";
import { VerificationView } from "@/features/config/verification-view";
import { SEED_PROJECTS } from "@/features/projects/seed";
import { resolveLocale } from "@/i18n/params";

export function generateStaticParams() {
  return SEED_PROJECTS.map((p) => ({ id: p.id }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/projects/[id]/verification">): Promise<Metadata> {
  return pageTitle(params, "verification");
}

export default async function Page({ params }: PageProps<"/[locale]/projects/[id]/verification">) {
  const { id } = await params;
  await resolveLocale(params);
  return <VerificationView id={id} />;
}
