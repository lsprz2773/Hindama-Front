import { handleMfaDisable, getDeps } from "@/server/bff";

export async function POST(request: Request) {
  return handleMfaDisable(request, await getDeps());
}
