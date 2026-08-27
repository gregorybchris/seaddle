import { haversineMeters } from "@/lib/geo/distance";
import { crop, elevationGain, polylineMeters } from "@/lib/geo/polyline";
import { SpatialIndex } from "@/lib/mapping/spatial-index";
import type { Coord, ElevCoord } from "@/lib/models/geo";
import { insideGap } from "@/lib/gpx/recording-gaps";
import type { Track } from "@/lib/models/track";

export type TrackPointRef = { track: string; index: number };

/**
 * Import guarantees a vertex every 15 m or better, so a click anywhere on a
 * road is within ~7.5 m of one. 25 m finds every ride through an intersection
 * without reaching the next street over.
 */
export const DEFAULT_RADIUS_METERS = 25;

/**
 * How far a candidate may wander relative to the straight line between the two
 * junctions. Three is generous on purpose — a segment tracing a shoreline is
 * legitimately several times its own crow-flight distance — but it still throws
 * out the track that touches both nodes with three miles of detour in between.
 */
export const DEFAULT_MAX_DETOUR_RATIO = 3;

/**
 * Consecutive hits are one pass through a junction. At the guaranteed 15 m
 * spacing a 25 m radius catches three or four vertices in a row, so a gap of
 * five indices (~75 m of riding) means the ride left and came back — a separate
 * pass. A GPS track stopped at the light will bunch more vertices into the
 * radius, which is still one run and still one pass.
 */
const PASS_GAP_INDICES = 5;

export type CandidateOptions = {
  radiusMeters?: number;
  maxDetourRatio?: number;
  minMeters?: number;
};

export type Candidate = {
  track: string;
  trackName: string;
  /** When the ride happened, ISO 8601, or null for a route that was drawn. */
  trackDate: string | null;
  startIndex: number;
  endIndex: number;
  /** Cropped and oriented from → to, but not yet snapped or simplified. */
  points: ElevCoord[];
  meters: number;
  gainForward: number;
  gainBackward: number;
  /** Path length over crow-flight distance. 1.0 is perfectly direct. */
  detourRatio: number;
  /** How far the track passed from the two junctions, added together. */
  endpointMeters: number;
  /**
   * Spread of the vertex spacing. Measured on the real set, drawn routes run
   * 1.06–3.07 and recorded ones 0.71–1.96, so this leans towards recorded
   * geometry — which renders more smoothly, though it is not automatically the
   * more accurate line. Hence a tiebreaker, weighted well below directness.
   */
  spacingCv: number;
  pointCount: number;
  score: number;
  /** Other passes the same track makes between these junctions. */
  alternates: Candidate[];
};

/**
 * Every ride's points, ready to be searched near a click.
 *
 * Points that only exist because import filled a stretch the recorder never
 * saw are left out. Otherwise a junction could be placed in the middle of Puget
 * Sound, on the line a GPS leaves behind while its owner is on a ferry, and a
 * segment extracted along it.
 */
export function buildTrackIndex(
  tracks: Track[],
  cellMeters = 100,
): SpatialIndex<TrackPointRef> {
  const entries = tracks.flatMap((track) =>
    track.points.flatMap((point, index) =>
      insideGap(track.gaps ?? [], index)
        ? []
        : [
            {
              coord: [point[0], point[1]] as Coord,
              item: { track: track.slug, index },
            },
          ],
    ),
  );
  return new SpatialIndex(entries, cellMeters);
}

export type Visit = { track: string; index: number; distanceMeters: number };

/**
 * Where tracks pass near a coordinate, one entry per pass.
 *
 * A loop that comes back around gets two visits rather than one blurred
 * average, which is what makes it possible to offer both passes as candidates
 * instead of silently picking whichever point happened to be nearest.
 */
export function findVisits(
  index: SpatialIndex<TrackPointRef>,
  coord: Coord,
  radiusMeters: number,
): Visit[] {
  const byTrack = new Map<
    string,
    { index: number; distanceMeters: number }[]
  >();
  for (const hit of index.within(coord, radiusMeters)) {
    const existing = byTrack.get(hit.item.track);
    const entry = { index: hit.item.index, distanceMeters: hit.distanceMeters };
    if (existing) existing.push(entry);
    else byTrack.set(hit.item.track, [entry]);
  }

  const visits: Visit[] = [];
  for (const [track, hits] of byTrack) {
    hits.sort((a, b) => a.index - b.index);
    let run = [hits[0]];
    for (const hit of hits.slice(1)) {
      if (hit.index - run[run.length - 1].index > PASS_GAP_INDICES) {
        visits.push(closest(track, run));
        run = [hit];
      } else {
        run.push(hit);
      }
    }
    visits.push(closest(track, run));
  }
  return visits;
}

function closest(
  track: string,
  run: { index: number; distanceMeters: number }[],
): Visit {
  const best = run.reduce((a, b) =>
    b.distanceMeters < a.distanceMeters ? b : a,
  );
  return { track, index: best.index, distanceMeters: best.distanceMeters };
}

/**
 * Every plausible piece of geometry running between two junctions, ranked.
 *
 * Passing near both junctions is not enough to qualify: a ride can touch one,
 * wander three miles away, and come back to the other. So each candidate is
 * scored on how directly it gets there, how close it actually came to the
 * junctions, and how evenly its points are spaced — and the ones that wander
 * are dropped rather than offered.
 *
 * One entry per track, best pass first, with the track's other passes attached
 * as alternates.
 */
export function findCandidates(
  tracks: Track[],
  index: SpatialIndex<TrackPointRef>,
  from: Coord,
  to: Coord,
  options: CandidateOptions = {},
): Candidate[] {
  const radiusMeters = options.radiusMeters ?? DEFAULT_RADIUS_METERS;
  const maxDetourRatio = options.maxDetourRatio ?? DEFAULT_MAX_DETOUR_RATIO;
  const minMeters = options.minMeters ?? 20;

  const straightMeters = haversineMeters(from, to);
  if (straightMeters === 0) return [];

  const byTrack = new Map<string, Track>(tracks.map((t) => [t.slug, t]));
  const visitsFrom = groupByTrack(findVisits(index, from, radiusMeters));
  const visitsTo = groupByTrack(findVisits(index, to, radiusMeters));

  const perTrack = new Map<string, Candidate[]>();

  for (const [slug, starts] of visitsFrom) {
    const ends = visitsTo.get(slug);
    const track = byTrack.get(slug);
    if (!ends || !track) continue;

    for (const start of starts) {
      for (const end of ends) {
        if (start.index === end.index) continue;
        const points = crop(track.points, start.index, end.index);
        const meters = polylineMeters(points);
        if (meters < minMeters) continue;
        const detourRatio = meters / straightMeters;
        if (detourRatio > maxDetourRatio) continue;

        const endpointMeters = start.distanceMeters + end.distanceMeters;
        const spacingCv = spacingCoefficientOfVariation(points);
        const candidate: Candidate = {
          track: slug,
          trackName: track.name,
          trackDate: track.recordedAt ?? null,
          startIndex: start.index,
          endIndex: end.index,
          points,
          meters,
          gainForward: elevationGain(points),
          gainBackward: elevationGain([...points].reverse()),
          detourRatio,
          endpointMeters,
          spacingCv,
          pointCount: points.length,
          score: score(detourRatio, endpointMeters, spacingCv, radiusMeters),
          alternates: [],
        };
        const existing = perTrack.get(slug);
        if (existing) existing.push(candidate);
        else perTrack.set(slug, [candidate]);
      }
    }
  }

  const best: Candidate[] = [];
  for (const candidates of perTrack.values()) {
    // Within one ride, the cleanest pass leads and the rest become alternates.
    candidates.sort((a, b) => a.score - b.score);
    const [primary, ...alternates] = candidates;
    best.push({ ...primary, alternates });
  }
  return best.sort(byMostRecent);
}

/**
 * Newest ride first.
 *
 * Recency is the ordering that matches how the geometry is actually chosen: a
 * road resurfaced or a trail rerouted since an older ride was recorded, and the
 * most recent pass is the one that reflects what is there now. Scoring still
 * decides what qualifies at all — a candidate that wanders is rejected outright
 * rather than merely ranked low — and every number behind it stays on the card.
 *
 * Drawn routes carry no date and sort last, ordered among themselves by how
 * cleanly they run.
 */
function byMostRecent(a: Candidate, b: Candidate): number {
  if (a.trackDate && b.trackDate) {
    // ISO 8601 compares chronologically as text.
    return b.trackDate.localeCompare(a.trackDate);
  }
  if (a.trackDate) return -1;
  if (b.trackDate) return 1;
  return a.score - b.score;
}

/**
 * Lower is better. Directness dominates, because a wandering candidate is
 * wrong rather than merely untidy; the other two break ties between tracks that
 * both take a sensible line.
 */
function score(
  detourRatio: number,
  endpointMeters: number,
  spacingCv: number,
  radiusMeters: number,
): number {
  return (
    detourRatio +
    (endpointMeters / (2 * radiusMeters)) * 0.5 +
    Math.min(spacingCv, 2) * 0.25
  );
}

function spacingCoefficientOfVariation(points: ElevCoord[]): number {
  if (points.length < 3) return 0;
  const gaps: number[] = [];
  for (let i = 1; i < points.length; i++) {
    gaps.push(
      haversineMeters(
        [points[i - 1][0], points[i - 1][1]],
        [points[i][0], points[i][1]],
      ),
    );
  }
  const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  if (mean === 0) return 0;
  const variance =
    gaps.reduce((sum, gap) => sum + (gap - mean) ** 2, 0) / gaps.length;
  return Math.sqrt(variance) / mean;
}

function groupByTrack(visits: Visit[]): Map<string, Visit[]> {
  const grouped = new Map<string, Visit[]>();
  for (const visit of visits) {
    const existing = grouped.get(visit.track);
    if (existing) existing.push(visit);
    else grouped.set(visit.track, [visit]);
  }
  return grouped;
}
