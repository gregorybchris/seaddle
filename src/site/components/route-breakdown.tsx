import { useUnits } from "@/lib/use-units";
import { humanize } from "@/lib/utilities/words";
import { breakdown, isAttribute, RAMPS, type Encoding } from "../encoding";
import type { SiteSegment } from "../graph-data";

/**
 * What the route is actually made of, by distance.
 *
 * The reason to build a route here rather than on a site that already has
 * millions of them: a beginner can see that four fifths of it has a decent
 * bike lane, or that the gravel is a mile of it and not a token stretch. Read
 * in distance, not in segments — a route is nine tenths good bike lane whether
 * that is one long segment or twelve short ones.
 *
 * Elevation has no shares to divide up — it is measured along a segment rather
 * than assigned to one — so a map colored by it breaks the route down by
 * steepness instead, which is the same question asked of the whole segment.
 */
export function RouteBreakdown({
  segments,
  encoding,
}: {
  segments: SiteSegment[];
  encoding: Encoding;
}) {
  const { distance } = useUnits();
  const attribute = isAttribute(encoding) ? encoding : "steepness";
  const shares = breakdown(segments, attribute);
  if (shares.length === 0) return null;

  return (
    <section className="flex flex-col gap-1.5">
      <div
        className="border-forest-deep/40 flex h-2 overflow-hidden rounded-full border"
        role="img"
        aria-label={shares
          .map(
            (share) =>
              `${Math.round(share.share * 100)}% ${share.value}, ${distance(share.meters)}`,
          )
          .join("; ")}
      >
        {shares.map((share) => (
          <span
            key={share.value}
            style={{
              width: `${share.share * 100}%`,
              backgroundColor: RAMPS[attribute][share.value],
            }}
          />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-3 gap-y-0.5">
        {shares.map((share) => (
          <li key={share.value} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="ring-sand/30 h-1.5 w-1.5 shrink-0 rounded-full ring-1"
              style={{ backgroundColor: RAMPS[attribute][share.value] }}
            />
            <span className="text-sand/70 text-[0.6875rem]">
              {humanize(share.value)}
            </span>
            <span className="tabular text-sand/70 text-[0.6875rem]">
              {distance(share.meters)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
