import { getDeps, handleSignIn } from "@/server/bff";

export async function POST(request: Request) {
  return handleSignIn(request, await getDeps());
}
