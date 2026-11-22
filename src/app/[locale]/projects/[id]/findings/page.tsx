import type { Metadata } from "next";
import { RouteParams } from "@/components/layout/route-params";
import { pageTitle } from "@/i18n/metadata";
import { FindingsView } from "@/features/runs/findings-view";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/projects/[id]/findings">): Promise<Metadata> {
  return pageTitle(params, "findings");
}

export default function Page({ params }: PageProps<"/[locale]/projects/[id]/findings">) {
  return <RouteParams params={params}>{({ id }) => <FindingsView id={id} />}</RouteParams>;
}
