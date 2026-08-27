import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utilities/style-utils";

type Variant = "primary" | "outline" | "quiet";

/**
 * Chunky and obviously pressable, in the spirit of PostHog's controls: a solid
 * fill, a defined border, and a hard offset shadow the button drops into when
 * you push it.
 */
const BASE =
  "inline-flex select-none items-center justify-center gap-2 rounded-md border-2 px-3 py-2 text-sm transition-all " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 " +
  "disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0 " +
  "active:translate-x-[2px] active:translate-y-[2px] active:shadow-none";

const VARIANTS: Record<Variant, string> = {
  primary:
    "border-forest-deep bg-forest text-paper shadow-[2px_2px_0_0_var(--color-forest-deep)] hover:bg-forest-deep",
  outline:
    "border-ink/20 bg-paper text-ink shadow-[2px_2px_0_0_var(--color-ink)]/20 hover:bg-sand",
  quiet: "border-transparent text-ink/70 shadow-none hover:bg-ink/5",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  selected?: boolean;
};

export function Button({
  variant = "outline",
  selected = false,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      className={cn(BASE, VARIANTS[selected ? "primary" : variant], className)}
      {...props}
    />
  );
}
