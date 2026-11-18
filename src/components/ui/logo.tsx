import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { Icon } from "./icon";

interface LogoProps {
  href?: string;
  /** Texto accesible del enlace. */
  label: string;
  size?: "md" | "lg";
  className?: string;
  showName?: boolean;
}

export function Logo({ href = "/", label, size = "md", className, showName = true }: LogoProps) {
  const lg = size === "lg";
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn("text-fg flex items-center gap-3 no-underline", className)}
    >
      <span
        aria-hidden="true"
        className={cn(
          "bg-accent text-on-accent inline-flex flex-none items-center justify-center",
          lg ? "size-11 rounded-[14px]" : "size-10 rounded-[13px]",
        )}
      >
        <Icon name="logo" size={lg ? 24 : 22} />
      </span>
      {showName ? (
        <span
          className={cn(
            "font-display font-semibold tracking-[-0.02em]",
            lg ? "text-2xl" : "text-[22px]",
          )}
        >
          Hindama
        </span>
      ) : null}
    </Link>
  );
}
