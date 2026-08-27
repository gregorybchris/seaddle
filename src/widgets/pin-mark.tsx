import {
  Bicycle,
  Camera,
  Drop,
  PicnicTable,
  Toilet,
  Warning,
  type Icon,
} from "@phosphor-icons/react";
import { PIN_LABELS, PIN_WARNINGS, type PinKind } from "@/lib/models/graph";
import { cn } from "@/lib/utilities/style-utils";

const ICONS: Record<PinKind, Icon> = {
  drinkingWater: Drop,
  restroom: Toilet,
  viewpoint: Camera,
  restStop: PicnicTable,
  bikeShop: Bicycle,
  hazard: Warning,
};

/**
 * A point of interest, drawn as the thing it is.
 *
 * Icons rather than colored dots: six kinds is more than color can carry on its
 * own, and a tap is a poor way to find out that the dot you wanted was the
 * other one.
 *
 * A warning takes the edge and the icon in blaze while an amenity takes forest.
 * That leaves the fill free to go on meaning selected, so the two readings sit
 * on separate axes and a selected hazard is still legibly both.
 */
export function PinMark({
  kind,
  className,
  selected = false,
  decorative = false,
}: {
  kind: PinKind;
  className?: string;
  selected?: boolean;
  /** For when something around it already carries the name. */
  decorative?: boolean;
}) {
  const Icon = ICONS[kind];
  const warning = PIN_WARNINGS.has(kind);
  return (
    <span
      // A bare span may not carry a label, so where nothing else names this
      // the mark itself has to be the image. Where something does — a button
      // wrapping it, a row of text beside it — a second name would only be
      // read out twice.
      {...(decorative
        ? { "aria-hidden": true }
        : { role: "img", "aria-label": PIN_LABELS[kind] })}
      className={cn(
        "flex h-5 w-5 items-center justify-center rounded-full border-2 shadow",
        warning ? "border-blaze-deep" : "border-forest-deep",
        selected && "bg-blaze text-forest-deep",
        !selected &&
          (warning ? "bg-paper text-blaze-deep" : "bg-paper text-forest"),
        className,
      )}
    >
      <Icon weight="fill" className="h-2.5 w-2.5" aria-hidden />
    </span>
  );
}
