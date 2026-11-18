import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Negocia el idioma (cookie, Accept-Language) y aplica el prefijo `/en`.
export default createMiddleware(routing);

export const config = {
  // Todo menos /api, archivos internos de Next y recursos con extensión.
  matcher: "/((?!api|trpc|_next|_vercel|.*\..*).*)",
};
