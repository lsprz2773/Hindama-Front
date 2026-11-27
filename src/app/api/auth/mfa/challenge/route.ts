import { handleMfaChallenge, getDeps } from "@/server/bff";

export async function POST(request: Request) {
  return handleMfaChallenge(request, await getDeps());
}
