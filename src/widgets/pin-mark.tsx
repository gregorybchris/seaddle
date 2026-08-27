import {
  Bicycle,
  Camera,
  Drop,
  PicnicTable,
  Toilet,
} from "@phosphor-icons/react";
import { PIN_LABELS, type PinKind } from "@/lib/models/graph";
import { cn } from "@/lib/utilities/style-utils";

const ICONS = {
  water: Drop,
  bathroom: Toilet,
  photo: Camera,
  rest: PicnicTable,
  "bike-shop": Bicycle,
} as const;

/**
 * A point of interest, drawn as the thing it is.
 *
 * Icons rather than colored dots: five kinds is more than color can carry on
 * its own, and a tap is a poor way to find out that the dot you wanted was the
 * other one.
 */
export function PinMark({
  kind,
  className,
  selected = false,
}: {
  kind: PinKind;
  className?: string;
  selected?: boolean;
}) {
  const Icon = ICONS[kind];
  return (
    <span
      // A bare span may not carry a label. On the map there is no adjacent
      // text to name it, so the mark itself has to be the image.
      role="img"
      aria-label={PIN_LABELS[kind]}
      className={cn(
        "border-forest-deep flex h-5 w-5 items-center justify-center rounded-full border-2 shadow",
        selected ? "bg-blaze text-forest-deep" : "bg-paper text-forest",
        className,
      )}
    >
      <Icon weight="fill" className="h-2.5 w-2.5" aria-hidden />
    </span>
  );
}
