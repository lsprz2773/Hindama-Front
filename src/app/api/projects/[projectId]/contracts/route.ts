import { apiRoute } from "@/server/bff/route";
import { SPECS } from "@/server/bff/specs";

/** `listContracts` (V-20): versiones del contrato, paginadas. */
export const GET = apiRoute(SPECS.listContracts);

/** `importContract` (V-19): un archivo de hasta 5 MB o una URL, como `multipart/form-data`. */
export const POST = apiRoute(SPECS.importContract);
