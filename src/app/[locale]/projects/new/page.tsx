import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { NewProjectView } from "@/features/projects/new-project-view";
import { resolveLocale } from "@/i18n/params";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/projects/new">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const p = await getTranslations({ locale, namespace: "Projects" });
  return { title: p("newProject") };
}

export default async function NewProjectPage({ params }: PageProps<"/[locale]/projects/new">) {
  const locale = await resolveLocale(params);
  const p = await getTranslations({ locale, namespace: "Projects" });
  return (
    <AppShell
      role="analyst"
      title={p("newProject")}
      breadcrumb={[{ label: p("title"), href: "/projects" }, { label: p("newProject") }]}
    >
      <NewProjectView />
    </AppShell>
  );
}
