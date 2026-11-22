import { getDeps, handleConfirmSignUp } from "@/server/bff";

export async function POST(request: Request) {
  return handleConfirmSignUp(request, await getDeps());
}
