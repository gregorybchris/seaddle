import { useId, useRef, useState } from "react";
import { elevationProfile, sampleAt } from "@/lib/geo/profile";
import type { ElevCoord } from "@/lib/models/geo";
import { cn } from "@/lib/utilities/style-utils";
import { formatFeet, formatMiles } from "@/lib/utilities/units";

const WIDTH = 300;
const HEIGHT = 64;

/**
 * The shape of the ride, drawn to scale along its length, and readable at any
 * point along it.
 *
 * Seattle decides a ride by its hills, so this is the one picture worth showing
 * a rider before they set off — and "how high is that bit in the middle" is the
 * question the picture immediately provokes. The vertical range is held to a
 * floor so a flat trail does not draw like a mountain range just because the
 * axis was fitted to three meters of noise.
 */
export function ElevationProfile({
  points,
  className,
  minRangeMeters = 30,
  onScrub,
}: {
  points: ElevCoord[];
  className?: string;
  minRangeMeters?: number;
  /**
   * Where along the ride the reader is looking, 0 to 1, or null once they
   * stop. Lets the map put the same place under a marker — a height without a
   * "where" only answers half the question.
   */
  onScrub?: (fraction: number | null) => void;
}) {
  const gradientId = useId();
  const chart = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState<number | null>(null);

  const profile = elevationProfile(points, 96);
  if (profile.samples.length < 2) return null;

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

  /** Reported from the handlers rather than during render, where it would be a side effect. */
  function scrubTo(index: number | null) {
    setAt(index);
    onScrub?.(index === null ? null : index / steps);
  }

  function moveTo(event: React.PointerEvent) {
    const box = chart.current?.getBoundingClientRect();
    if (!box || box.width === 0) return;
    const fraction = (event.clientX - box.left) / box.width;
    scrubTo(Math.round(Math.max(0, Math.min(1, fraction)) * steps));
  }

  function nudge(by: number) {
    scrubTo(Math.max(0, Math.min(steps, (at ?? Math.round(steps / 2)) + by)));
  }

  return (
    <figure className={cn("flex flex-col gap-1", className)}>
      <div
        ref={chart}
        // A slider rather than an image: it has a position along it that can be
        // moved and read, which is exactly what arrow keys should do here.
        role="slider"
        tabIndex={0}
        aria-label="Elevation along the ride"
        aria-valuemin={0}
        aria-valuemax={Math.round(profile.meters)}
        aria-valuenow={Math.round(reading?.meters ?? 0)}
        aria-valuetext={
          reading
            ? `${formatMiles(reading.meters)}, ${formatFeet(reading.elevation)}`
            : "Nothing selected"
        }
        onPointerMove={moveTo}
        onPointerDown={moveTo}
        onPointerLeave={() => scrubTo(null)}
        onBlur={() => scrubTo(null)}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") nudge(1);
          else if (event.key === "ArrowLeft") nudge(-1);
          else if (event.key === "Home") scrubTo(0);
          else if (event.key === "End") scrubTo(steps);
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
        {at !== null && reading && (
          <>
            <span
              aria-hidden
              className="bg-blaze/50 pointer-events-none absolute inset-y-0 w-px"
              style={{ left: `${(at / steps) * 100}%` }}
            />
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

      {/* Same two slots either way, so reading the hill does not shift the
          panel under the pointer. */}
      <figcaption className="tabular flex justify-between text-[0.625rem]">
        {reading ? (
          <>
            <span className="text-blaze">{formatMiles(reading.meters)}</span>
            <span className="text-blaze">{formatFeet(reading.elevation)}</span>
          </>
        ) : (
          <>
            <span className="text-sand/70">
              {formatFeet(profile.minMeters)}
            </span>
            <span className="text-sand/70">
              {formatFeet(profile.maxMeters)}
            </span>
          </>
        )}
      </figcaption>
    </figure>
  );
}
