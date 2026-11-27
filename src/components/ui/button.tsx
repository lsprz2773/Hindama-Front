import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { Icon } from "./icon";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-2xl text-[15px] no-underline transition duration-150 cursor-pointer hover:brightness-110 active:translate-y-px active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-accent font-bold text-on-accent",
        secondary: "border border-line bg-panel-2 font-semibold text-fg",
        danger: "bg-danger font-bold text-white",
        ghost: "bg-transparent font-semibold text-link",
      },
      size: {
        sm: "min-h-[46px] px-5",
        md: "min-h-[50px] px-6",
        lg: "min-h-[54px] px-7 text-base",
        xl: "min-h-14 px-8 text-base",
      },
      block: { true: "w-full", false: "" },
    },
    defaultVariants: { variant: "primary", size: "md", block: false },
  },
);

type ButtonVariants = VariantProps<typeof buttonVariants>;

interface ButtonProps extends ComponentProps<"button">, ButtonVariants {
  /** Muestra el spinner y bloquea el doble envío. */
  loading?: boolean;
}

export function Button({
  variant,
  size,
  block,
  loading,
  className,
  children,
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size, block }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <Icon name="spinner" size={18} strokeWidth={2.6} className="animate-spin" />
      ) : null}
      {children}
    </button>
  );
}

interface ButtonLinkProps extends ComponentProps<typeof Link>, ButtonVariants {}

/** Enlace con apariencia de botón; respeta el prefijo de idioma. */
export function ButtonLink({ variant, size, block, className, ...props }: ButtonLinkProps) {
  return <Link className={cn(buttonVariants({ variant, size, block }), className)} {...props} />;
}
