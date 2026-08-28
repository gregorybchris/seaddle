import { cn } from "@/lib/utilities/style-utils";
import { humanize } from "@/lib/utilities/words";
import { STEEPEST_GRADE } from "../grade";
import {
  ENCODING_VALUES,
  GRADE_STOPS,
  isAttribute,
  RAMPS,
  type Encoding,
} from "../encoding";

/**
 * What the colors on the map currently mean.
 *
 * On the map rather than in the panel that used to hold it, and rather than in
 * the dialog that now sets it. A key is only worth anything beside the thing it
 * explains: closing a dialog to look at the roads would take the key away at
 * exactly the moment it was wanted.
 *
 * Pale, because it sits on the basemap now instead of on the sheet — and
 * translucent over a blur rather than solid, so it reads as laid on the map
 * rather than as a hole cut in it. The swatches keep their outline: the dark
 * end of every ramp is tuned against a near-white ground and would otherwise
 * disappear into this one.
 */
export function MapLegend({
  encoding,
  className,
}: {
  encoding: Encoding;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-forest-deep/15 bg-paper/85 text-ink pointer-events-none w-fit max-w-[11rem] rounded-lg border px-2.5 py-2 shadow-[0_1px_6px_rgba(18,48,31,0.12)] backdrop-blur-[2px] select-none",
        className,
      )}
    >
      <p className="eyebrow text-forest/70 mb-1.5 text-[0.625rem]">
        {isAttribute(encoding) ? humanize(encoding) : "grade"}
      </p>
      {isAttribute(encoding) ? (
        <ul className="flex flex-col gap-1">
          {ENCODING_VALUES[encoding].map((value) => (
            <li key={value} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="ring-forest-deep/20 h-1.5 w-4 shrink-0 rounded-full ring-1"
                style={{ backgroundColor: RAMPS[encoding][value] }}
              />
              <span className="text-ink/75 text-[0.6875rem] leading-tight">
                {humanize(value)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <GradeLegend />
      )}
    </div>
  );
}

/**
 * A bar rather than a row of swatches, because grade is continuous.
 *
 * Only the ends are labeled. The exact percentage under any one stretch of
 * road is not a thing anyone is going to read off a legend, and the elevation
 * chart gives the real number for a route once one is built; what this has to
 * say is which end of the bar is the hard one.
 */
function GradeLegend() {
  const ramp = GRADE_STOPS.map(
    ([grade, color]) => `${color} ${(grade / STEEPEST_GRADE) * 100}%`,
  ).join(", ");

  return (
    <div className="flex w-24 flex-col gap-1">
      <span
        aria-hidden
        className="ring-forest-deep/20 h-1.5 w-full rounded-full ring-1"
        style={{ backgroundImage: `linear-gradient(to right, ${ramp})` }}
      />
      <div className="text-ink/75 flex justify-between text-[0.6875rem]">
        <span>flat</span>
        <span className="tabular">{STEEPEST_GRADE}%+</span>
      </div>
    </div>
  );
}
