import type { Metadata } from "next";
import { RouteParams } from "@/components/layout/route-params";
import { pageTitle } from "@/i18n/metadata";
import { HistoryView } from "@/features/runs/history-view";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/projects/[id]/history">): Promise<Metadata> {
  return pageTitle(params, "history");
}

export default function Page({ params }: PageProps<"/[locale]/projects/[id]/history">) {
  return <RouteParams params={params}>{({ id }) => <HistoryView id={id} />}</RouteParams>;
}
