import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ProjectsScreen } from "@/features/projects/projects-view";
import { resolveLocale } from "@/i18n/params";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/projects">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "Projects" });
  return { title: t("title") };
}

export default async function ProjectsPage({ params }: PageProps<"/[locale]/projects">) {
  await resolveLocale(params);
  return <ProjectsScreen />;
}
