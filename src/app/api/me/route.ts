import { meSchema } from "@/lib/api/schemas/account";
import { apiRoute } from "@/server/bff/route";

/** `getMe` (C-01, V-04, V-07, V-09, V-14): datos de la cuenta, rol y términos. */
export const GET = apiRoute({ path: ["me"], response: meSchema });
