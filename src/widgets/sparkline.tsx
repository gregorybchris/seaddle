import { useId } from "react";
import { elevationProfile } from "@/lib/geo/profile";
import type { ElevCoord } from "@/lib/models/geo";
import { cn } from "@/lib/utilities/style-utils";

type SparklineProps = {
  points: ElevCoord[];
  className?: string;
  /** Flattens a molehill so it does not draw like a mountain. */
  minRangeMeters?: number;
};

const WIDTH = 100;
const HEIGHT = 24;

/**
 * A segment's climb, at a glance.
 *
 * Seattle riding is decided by hills, so the shape of the climb is the thing
 * worth seeing before choosing a piece of geometry. The vertical range is held
 * to a floor: a two-meter rise over a mile is flat, and drawing it edge to edge
 * would make every flat trail look like Queen Anne.
 */
export function Sparkline({
  points,
  className,
  minRangeMeters = 25,
}: SparklineProps) {
  const gradientId = useId();
  const profile = elevationProfile(points, 40);
  if (profile.samples.length < 2) return null;

  const range = Math.max(profile.maxMeters - profile.minMeters, minRangeMeters);
  const middle = (profile.maxMeters + profile.minMeters) / 2;
  const floor = middle - range / 2;

  const coordinates = profile.samples.map((meters, i) => {
    const x = (i / (profile.samples.length - 1)) * WIDTH;
    const y = HEIGHT - ((meters - floor) / range) * HEIGHT;
    return [x, Math.max(1, Math.min(HEIGHT - 1, y))] as const;
  });

  const line = coordinates
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      className={cn("h-6 w-full", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.35" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
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
  );
}
