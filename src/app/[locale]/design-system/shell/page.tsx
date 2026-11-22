import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Banner } from "@/components/ui/banner";
import { resolveLocale } from "@/i18n/params";

/** Marco autenticado con barra lateral de proyecto. Solo en desarrollo. */
export default async function ShellPage({ params }: PageProps<"/[locale]/design-system/shell">) {
  await resolveLocale(params);
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <AppShell
      role="analyst"
      project={{
        id: "demo",
        name: "API de Pedidos",
        notes: {
          verification: { text: "Hecho" },
          contract: { text: "42 op." },
          identities: { text: "3" },
          policy: { text: "4 sin confirmar", warning: true },
          findings: { text: "15" },
        },
        locked: { resources: "Disponible tras verificar" },
      }}
      breadcrumb={[
        { label: "Proyectos", href: "/projects" },
        { label: "API de Pedidos", href: "/projects/demo" },
        { label: "Hallazgos" },
      ]}
      title="Hallazgos"
      subtitle="Estado actual del proyecto."
    >
      <Banner title="Contenido de ejemplo">
        La barra lateral y la ruta son los componentes C-01, C-02 y C-03.
      </Banner>
    </AppShell>
  );
}
