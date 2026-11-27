import type { Metadata } from "next";
import { RouteParams } from "@/components/layout/route-params";
import { pageTitle } from "@/i18n/metadata";
import { VerificationView } from "@/features/config/verification-view";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/projects/[id]/verification">): Promise<Metadata> {
  return pageTitle(params, "verification");
}

export default function Page({ params }: PageProps<"/[locale]/projects/[id]/verification">) {
  return <RouteParams params={params}>{({ id }) => <VerificationView id={id} />}</RouteParams>;
}
