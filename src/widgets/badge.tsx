import type { ReactNode } from "react";
import { cn } from "@/lib/utilities/style-utils";

/**
 * How good the news is, rather than what the news is about.
 *
 * Four steps and no scale: a badge answers "is this in my favour", which two
 * different values can answer the same way — a bike lane and a bike path are
 * both a yes, and ranking them is a job for the map's own colors.
 */
export type Tone = "good" | "caution" | "poor" | "neutral";

/**
 * Built the way everything filled on this site is built: a deeper edge drawn
 * around the color's own fill, with type on top in whichever of forest and
 * paper clears the contrast floor against it.
 *
 * That is the button's construction, minus the parts that promise a press —
 * the offset shadow it drops into, the fingertip height. A badge is read, not
 * pushed, so it keeps the color language and drops the affordance.
 *
 * `neutral` is the outline button and the unchosen chip: a sand edge over a
 * lifted forest, which is how the rest of the site says "nothing to report".
 * The alternative was a fourth fill, and a value whose whole meaning is that it
 * is unremarkable should not arrive with the same weight as the three that
 * mean something.
 */
const TONES: Record<Tone, string> = {
  good: "border-moss-deep bg-moss text-forest-deep",
  caution: "border-blaze-deep bg-blaze text-forest-deep",
  // Paper rather than forest, for the reason the danger button gives: forest
  // type on clay lands at 3:1, under the floor for type this size.
  poor: "border-clay-deep bg-clay text-paper",
  neutral: "border-sand/25 bg-forest-lift/40 text-sand",
};

export function Badge({
  tone,
  className,
  children,
}: {
  tone: Tone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        // The chips' radius, not the buttons': this is chip-sized, and a pill
        // that size reads as a status light rather than as part of the site.
        "inline-flex items-center rounded-md border px-2 py-0.5 leading-tight",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
