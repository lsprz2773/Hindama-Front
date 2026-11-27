import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Envoltorios de Link/redirect/useRouter/usePathname que respetan el prefijo de idioma.
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
