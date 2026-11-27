import { getDeps, handleResetPassword } from "@/server/bff";

export async function POST(request: Request) {
  return handleResetPassword(request, await getDeps());
}
