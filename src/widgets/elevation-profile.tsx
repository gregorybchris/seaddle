import { useId } from "react";
import { elevationProfile } from "@/lib/geo/profile";
import type { ElevCoord } from "@/lib/models/geo";
import { cn } from "@/lib/utilities/style-utils";
import { formatFeet, formatMiles } from "@/lib/utilities/units";

const WIDTH = 300;
const HEIGHT = 64;

/**
 * The shape of the ride, drawn to scale along its length.
 *
 * Seattle decides a ride by its hills, so this is the one picture worth showing
 * a rider before they set off. The vertical range is held to a floor so a flat
 * trail does not draw like a mountain range just because the axis was fitted to
 * three metres of noise.
 */
export function ElevationProfile({
  points,
  className,
  minRangeMeters = 30,
}: {
  points: ElevCoord[];
  className?: string;
  minRangeMeters?: number;
}) {
  const gradientId = useId();
  const profile = elevationProfile(points, 96);
  if (profile.samples.length < 2) return null;

  const range = Math.max(profile.maxMeters - profile.minMeters, minRangeMeters);
  const middle = (profile.maxMeters + profile.minMeters) / 2;
  const floor = middle - range / 2;

  const coordinates = profile.samples.map((meters, i) => {
    const x = (i / (profile.samples.length - 1)) * WIDTH;
    const y = HEIGHT - ((meters - floor) / range) * HEIGHT;
    return [x, Math.max(2, Math.min(HEIGHT - 2, y))] as const;
  });

  const line = coordinates
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");

  return (
    <figure className={cn("flex flex-col gap-1", className)}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        className="text-moss h-16 w-full"
        role="img"
        aria-label={`Elevation profile: ${formatFeet(profile.minMeters)} to ${formatFeet(profile.maxMeters)} over ${formatMiles(profile.meters)}`}
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
      <figcaption className="tabular text-sand/40 flex justify-between text-[0.625rem]">
        <span>{formatFeet(profile.minMeters)}</span>
        <span>{formatFeet(profile.maxMeters)}</span>
      </figcaption>
    </figure>
  );
}
