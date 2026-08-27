import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utilities/style-utils";

type Variant = "primary" | "outline" | "quiet";

/**
 * Chunky and obviously pressable: a solid fill, a defined edge, and a hard
 * offset shadow the button drops into when pushed. Sized for a fingertip.
 */
const BASE =
  "inline-flex min-h-11 select-none items-center justify-center gap-2 rounded-lg border px-3 text-sm " +
  "transition-[transform,box-shadow,background-color,color] duration-150 ease-[var(--ease-settle)] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blaze focus-visible:ring-offset-2 focus-visible:ring-offset-forest " +
  "disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none disabled:translate-none " +
  "active:translate-x-[2px] active:translate-y-[2px] active:shadow-none";

const VARIANTS: Record<Variant, string> = {
  primary:
    "border-blaze-deep bg-blaze text-forest-deep shadow-[2px_2px_0_0_var(--color-blaze-deep)] hover:brightness-110",
  outline:
    "border-sand/25 bg-forest-lift/40 text-sand shadow-[2px_2px_0_0_var(--color-forest-deep)] hover:bg-forest-lift/70",
  quiet: "border-transparent text-sand/60 hover:bg-sand/10 hover:text-sand",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

export function Button({
  variant = "outline",
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      className={cn(BASE, VARIANTS[variant], className)}
      {...props}
    />
  );
}
