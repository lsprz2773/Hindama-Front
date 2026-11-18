import { getLocale } from "next-intl/server";
import { createHttpClient, type HttpClient } from "./client";

/** Cliente HTTP para código de servidor (Server Components, Route Handlers, acciones). */
export async function getHttpClient(baseUrl: string): Promise<HttpClient> {
  const locale = await getLocale();
  return createHttpClient({ baseUrl, getLocale: () => locale });
}
