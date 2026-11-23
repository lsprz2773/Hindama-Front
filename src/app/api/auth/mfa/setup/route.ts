import { handleMfaSetup, getDeps } from "@/server/bff";

export async function POST(request: Request) {
  return handleMfaSetup(request, await getDeps());
}
