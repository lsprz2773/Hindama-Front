import { apiRoute } from "@/server/bff/route";
import { SPECS } from "@/server/bff/specs";

/** `getMe` (C-01, V-04, V-07, V-09, V-14): datos de la cuenta, rol y términos. */
export const GET = apiRoute(SPECS.getMe);
