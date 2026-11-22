import { getDeps, handleForgotPassword } from "@/server/bff";

export async function POST(request: Request) {
  return handleForgotPassword(request, await getDeps());
}
