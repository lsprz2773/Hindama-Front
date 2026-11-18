import type { Metadata } from "next";
import { pageTitle } from "@/i18n/metadata";
import { SEED_PROJECTS } from "@/features/projects/seed";
import { FindingsView } from "@/features/runs/findings-view";
import { resolveLocale } from "@/i18n/params";

export function generateStaticParams() {
  return SEED_PROJECTS.map((p) => ({ id: p.id }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/projects/[id]/findings">): Promise<Metadata> {
  return pageTitle(params, "findings");
}

export default async function Page({ params }: PageProps<"/[locale]/projects/[id]/findings">) {
  const { id } = await params;
  await resolveLocale(params);
  return <FindingsView id={id} />;
}
