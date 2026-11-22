import { getDeps, handleSignUp } from "@/server/bff";

export async function POST(request: Request) {
  return handleSignUp(request, await getDeps());
}
