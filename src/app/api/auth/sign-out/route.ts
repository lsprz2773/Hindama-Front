import { getDeps, handleSignOut } from "@/server/bff";

export async function POST(request: Request) {
  return handleSignOut(request, await getDeps());
}
