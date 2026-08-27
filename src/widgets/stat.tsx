import { cn } from "@/lib/utilities/style-utils";

/**
 * One number and what it counts.
 *
 * The value leads and the label follows in small caps, because when three of
 * these sit in a row the eye should be able to read across the numbers alone.
 */
export function Stat({
  value,
  label,
  className,
}: {
  value: string | number;
  label: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <span className="tabular text-sand text-lg leading-none">{value}</span>
      <span className="eyebrow text-sand/70">{label}</span>
    </div>
  );
}
