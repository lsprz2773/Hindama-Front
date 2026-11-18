import type { Metadata } from "next";
import { pageTitle } from "@/i18n/metadata";
import { RunProgressView } from "@/features/runs/run-progress-view";
import { SEED_PROJECTS } from "@/features/projects/seed";
import { resolveLocale } from "@/i18n/params";

export function generateStaticParams() {
  return SEED_PROJECTS.map((p) => ({ id: p.id }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/projects/[id]/runs/current">): Promise<Metadata> {
  return pageTitle(params, "runCurrent");
}

export default async function Page({ params }: PageProps<"/[locale]/projects/[id]/runs/current">) {
  const { id } = await params;
  await resolveLocale(params);
  return <RunProgressView id={id} />;
}
