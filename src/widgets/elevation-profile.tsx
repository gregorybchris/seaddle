import { useId, useRef, useState } from "react";
import { spanBetween, type Span, type Uncounted } from "@/lib/geo/polyline";
import { elevationProfile, sampleAt } from "@/lib/geo/profile";
import type { ElevCoord } from "@/lib/models/geo";
import { cn } from "@/lib/utilities/style-utils";
import { useUnits } from "@/lib/use-units";

const WIDTH = 300;
const HEIGHT = 64;

/**
 * How far a press has to travel before it counts as a band rather than a tap.
 *
 * Three samples of ninety-six is about a tenth of an inch on the drawn chart:
 * enough that a thumb landing untidily still gets the point reading it asked
 * for, and little enough that a deliberate drag is a band from the moment it
 * starts to look like one.
 */
const MIN_BAND = 3;

/** Whether a press has travelled far enough to be reading a stretch rather
 *  than a point. Asked before measuring one, and before reporting one. */
function isBand(start: number, end: number): boolean {
  return Math.abs(start - end) >= MIN_BAND;
}

/**
 * Where along the line the reader is, as fractions from 0 to 1.
 *
 * `at` is the point under the pointer; `from` is where a drag began, and is
 * null unless one is under way. The pair is reported rather than the band
 * alone because the moving end is still a place worth marking while the band
 * is being drawn.
 */
export type Scrub = { at: number; from: number | null };

/**
 * The shape of the route, drawn to scale along its length, and readable at any
 * point along it.
 *
 * Seattle decides a route by its hills, so this is the one picture worth
 * showing a rider before they set off — and "how high is that bit in the
 * middle" is the question the picture immediately provokes. The vertical range
 * is held to a floor so a flat trail does not draw like a mountain range just
 * because the axis was fitted to three meters of noise.
 *
 * A press that travels reads a stretch rather than a point, and only while it
 * is held. The caption keeps its outer two slots — a distance on the left and a
 * climb on the right — and they answer about the band instead of the route: how
 * long is that hill, and how much climbing is in it. The climb is the one the
 * drag was going in, so sweeping back across a hill you just measured gives you
 * the other side of it rather than the same number again. A band also opens a
 * middle slot for the rate the two outer numbers imply, which is the figure
 * that says whether a hill is a hill; a whole route's average steepness is not
 * a thing anyone rides, so the slot closes with the band. The question is asked
 * of a piece of segment with no name, so there is nowhere to put a lasting
 * answer and nothing to dismiss afterwards.
 */
export function ElevationProfile({
  points,
  crossed,
  className,
  minRangeMeters = 30,
  onScrub,
}: {
  points: ElevCoord[];
  /**
   * Legs of the line that are crossed rather than ridden, by the index of the
   * point each arrives at.
   *
   * They are drawn to no width at all, so a route that takes the ferry runs
   * from the Seattle shore straight on to the Bainbridge one. The alternative
   * is eight flat miles across the middle of the chart, which squashes every
   * hill the rider is actually going to meet in order to draw a stretch they
   * will be sitting down for.
   */
  crossed?: Uncounted;
  className?: string;
  minRangeMeters?: number;
  /**
   * What the reader is looking at, or null once they stop. Lets the map put
   * the same place under a marker and the same stretch under a highlight — a
   * height without a "where" only answers half the question, and a band
   * measured in the caption without one is the same half-answer again.
   */
  onScrub?: (scrub: Scrub | null) => void;
}) {
  const gradientId = useId();
  const chart = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState<number | null>(null);
  // Where the press landed, held for as long as it is down. Doubles as "a drag
  // is in progress", which is the only thing that separates reading a stretch
  // from reading a point.
  const [from, setFrom] = useState<number | null>(null);
  // Above the early return below, where a hook cannot go.
  const { distance, climb, climbRate } = useUnits();

  const profile = elevationProfile(points, 96, crossed);
  // A chart of nothing, which a route that is only a ferry crossing would draw
  // as a flat line across the panel with no distance under it.
  if (profile.samples.length < 2 || profile.meters === 0) return null;

  const range = Math.max(profile.maxMeters - profile.minMeters, minRangeMeters);
  const middle = (profile.maxMeters + profile.minMeters) / 2;
  const floor = middle - range / 2;
  const heightOf = (meters: number) =>
    Math.max(
      2,
      Math.min(HEIGHT - 2, HEIGHT - ((meters - floor) / range) * HEIGHT),
    );

  const coordinates = profile.samples.map((meters, i) => {
    const x = (i / (profile.samples.length - 1)) * WIDTH;
    return [x, heightOf(meters)] as const;
  });

  const line = coordinates
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");

  const steps = profile.samples.length - 1;
  const reading = at === null ? null : sampleAt(profile, at / steps);

  /**
   * Measured off the real points, not the ninety-six drawn samples, which would
   * quietly shave the climbing off every band. Anchor first and pointer second,
   * so a drag back down the chart is measured back down the segment.
   */
  function bandOf(start: number, end: number): Span | null {
    if (!isBand(start, end)) return null;
    return spanBetween(points, start / steps, end / steps, crossed);
  }

  const band = at === null || from === null ? null : bandOf(from, at);
  const rate = band && climbRate(band.gain, band.meters);

  /** Reported from the handlers rather than during render, where it would be a side effect. */
  function scrubTo(index: number | null, start: number | null = null) {
    setAt(index);
    setFrom(start);
    // Only a drag long enough to have drawn a band reports one, by the same
    // measure the caption uses — so the map highlights a stretch exactly when
    // the caption is describing one.
    onScrub?.(
      index === null
        ? null
        : {
            at: index / steps,
            from: start !== null && isBand(start, index) ? start / steps : null,
          },
    );
  }

  function indexAt(event: React.PointerEvent): number | null {
    const box = chart.current?.getBoundingClientRect();
    if (!box || box.width === 0) return null;
    const fraction = (event.clientX - box.left) / box.width;
    return Math.round(Math.max(0, Math.min(1, fraction)) * steps);
  }

  function nudge(by: number, extend = false) {
    const now = at ?? Math.round(steps / 2);
    const next = Math.max(0, Math.min(steps, now + by));
    scrubTo(next, extend ? (from ?? now) : null);
  }

  return (
    <figure className={cn("flex flex-col gap-1", className)}>
      <div
        ref={chart}
        // A slider rather than an image: it has a position along it that can be
        // moved and read, which is exactly what arrow keys should do here.
        role="slider"
        tabIndex={0}
        aria-label="Elevation profile"
        aria-valuemin={0}
        aria-valuemax={Math.round(profile.meters)}
        aria-valuenow={Math.round(reading?.meters ?? 0)}
        aria-valuetext={
          band
            ? `${distance(band.meters)} and ${climb(band.gain)} of climbing${rate ? `, at ${rate}` : ""}, from ${distance(band.fromMeters)} to ${distance(band.toMeters)}`
            : reading
              ? `${distance(reading.meters)}, ${climb(reading.elevation)}`
              : "Nothing selected"
        }
        onPointerMove={(event) => {
          const index = indexAt(event);
          // `from` is set only while the press is down, so a pointer merely
          // passing over the chart reads a point and nothing more.
          if (index !== null) scrubTo(index, from);
        }}
        onPointerDown={(event) => {
          const index = indexAt(event);
          if (index === null) return;
          // Captured so a drag that strays off these sixty-four pixels — which
          // a mouse sweeping sideways does constantly — keeps reading the band
          // instead of cancelling it.
          event.currentTarget.setPointerCapture(event.pointerId);
          scrubTo(index, index);
        }}
        // Letting go drops the band and leaves the point under the pointer,
        // which is where a desktop reader still is. A finger is not: lifting it
        // ends the touch, and the leave that follows clears the rest.
        onPointerUp={() => scrubTo(at, null)}
        onPointerCancel={() => scrubTo(null)}
        onPointerLeave={() => scrubTo(null)}
        onBlur={() => scrubTo(null)}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") nudge(1, event.shiftKey);
          else if (event.key === "ArrowLeft") nudge(-1, event.shiftKey);
          else if (event.key === "Home") scrubTo(0);
          else if (event.key === "End") scrubTo(steps);
          else if (event.key === "Escape") scrubTo(null);
          else return;
          event.preventDefault();
        }}
        // Scrubbing wins over scrolling inside these few pixels, or a drag on a
        // phone would move the panel instead of reading the hill.
        className="focus-visible:ring-blaze relative touch-none rounded focus-visible:ring-2 focus-visible:outline-none"
      >
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="none"
          className="text-moss h-16 w-full"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.4" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <path
            d={`${line} L${WIDTH} ${HEIGHT} L0 ${HEIGHT} Z`}
            fill={`url(#${gradientId})`}
          />
          <path
            d={line}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {/* Drawn over the chart rather than inside it: the SVG is stretched to
            fit, so a circle in its coordinates would come out an ellipse. */}
        {band && at !== null && from !== null && (
          // Both edges ruled, because a band with one edge is a marker with a
          // wash beside it and says nothing about where it began.
          <span
            aria-hidden
            className="border-blaze/60 bg-blaze/15 pointer-events-none absolute inset-y-0 border-x"
            style={{
              left: `${(Math.min(from, at) / steps) * 100}%`,
              width: `${(Math.abs(at - from) / steps) * 100}%`,
            }}
          />
        )}
        {at !== null && reading && (
          <>
            {!band && (
              <span
                aria-hidden
                className="bg-blaze/50 pointer-events-none absolute inset-y-0 w-px"
                style={{ left: `${(at / steps) * 100}%` }}
              />
            )}
            <span
              aria-hidden
              className="bg-blaze border-forest pointer-events-none absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border"
              style={{
                left: `${(at / steps) * 100}%`,
                top: `${(heightOf(reading.elevation) / HEIGHT) * 100}%`,
              }}
            />
          </>
        )}
      </div>

      {/* The outer two slots are the same either way, so reading the hill does
          not shift the panel under the pointer — and the same two questions,
          distance on the left and climb on the right, whether the subject is a
          point on the route or a band of it. The rate between them appears only
          for a band, and takes no width from the other two when it is absent. */}
      <figcaption className="tabular flex justify-between text-[0.625rem]">
        {band ? (
          <>
            <span className="text-blaze">{distance(band.meters)}</span>
            {rate && <span className="text-blaze/70">{rate}</span>}
            <span className="text-blaze">{climb(band.gain)}</span>
          </>
        ) : reading ? (
          <>
            <span className="text-blaze">{distance(reading.meters)}</span>
            <span className="text-blaze">{climb(reading.elevation)}</span>
          </>
        ) : (
          <>
            <span className="text-sand/70">{climb(profile.minMeters)}</span>
            <span className="text-sand/70">{climb(profile.maxMeters)}</span>
          </>
        )}
      </figcaption>
    </figure>
  );
}
