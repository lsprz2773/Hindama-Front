import { handleMfaVerify, getDeps } from "@/server/bff";

export async function POST(request: Request) {
  return handleMfaVerify(request, await getDeps());
}
