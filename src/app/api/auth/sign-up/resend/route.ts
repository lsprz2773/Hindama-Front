import { getDeps, handleResendCode } from "@/server/bff";

export async function POST(request: Request) {
  return handleResendCode(request, await getDeps());
}
