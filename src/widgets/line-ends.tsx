import { Marker } from "react-map-gl";
import type { Coord, ElevCoord } from "@/lib/models/geo";

/**
 * Which way a line on the map runs: a green dot where it sets off, a checkered
 * flag where it finishes.
 *
 * A line drawn on a map has no visible direction, and three places on this site
 * need one — the segment being read, the route being built, and the segment
 * being edited in the admin. They were three copies of the same two markers,
 * which is three chances for one of them to drift into answering the same
 * question a second way. It is one question, so it is one pair of marks.
 *
 * The subject names them apart for a reader who cannot see either: two green
 * dots on a screen are told apart by what they are the start of.
 */
export function LineEnds({
  start,
  finish,
  subject,
}: {
  start: Coord | ElevCoord;
  finish: Coord | ElevCoord;
  /** What these are the ends of — "Segment", "Route" — for the labels. */
  subject: string;
}) {
  return (
    <>
      <Marker longitude={start[0]} latitude={start[1]}>
        <span
          aria-label={`${subject} start`}
          className="border-forest-deep bg-moss block h-3.5 w-3.5 rounded-full border-2 shadow"
        />
      </Marker>
      <Marker longitude={finish[0]} latitude={finish[1]}>
        <span aria-label={`${subject} finish`} className="checkered block" />
      </Marker>
    </>
  );
}
