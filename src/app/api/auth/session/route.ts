import { getDeps, handleSession } from "@/server/bff";

export async function GET(request: Request) {
  return handleSession(request, await getDeps());
}
