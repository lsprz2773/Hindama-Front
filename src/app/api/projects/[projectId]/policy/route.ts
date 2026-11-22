import { apiRoute } from "@/server/bff/route";
import { SPECS } from "@/server/bff/specs";

/** `applyPolicy` (V-24): aplica una plantilla a varias operaciones. */
export const POST = apiRoute(SPECS.applyPolicy);
