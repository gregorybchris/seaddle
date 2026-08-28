import { useEffect, useState } from "react";
import type { SegmentId } from "@/lib/models/graph";
import type { SiteGraph } from "./graph-data";
import { readLink, writeLink } from "./link";
import type { Mode } from "./mode";

/**
 * The road being read, and the half of the link that says so.
 *
 * In the address bar rather than in storage, and the difference is the point:
 * this is not a setting, it is where the reader has got to, and where someone
 * has got to is what a link is for. A rider who taps a road worth telling a
 * friend about can now send them the road, not the map with instructions.
 *
 * Never pushed. A selection is not a step in anything — the back button walks
 * the route timeline, and a version that pushed here would spend it on
 * un-selecting roads before it ever reached a turn worth taking back.
 *
 * Only advertised while exploring, because the mode is read back off the link:
 * an `?s=` left behind by a rider who has gone back to building would open a
 * stranger on the segment panel for a road nobody is looking at. It stays in
 * memory either way, so stepping out to build and back does not lose the road.
 */
export function useSelection(
  mode: Mode,
  graph: SiteGraph | null,
): [SegmentId | null, (id: SegmentId | null) => void] {
  const [selected, setSelected] = useState<SegmentId | null>(
    () => readLink().selected,
  );

  useEffect(() => {
    const assert = () =>
      writeLink({ selected: mode === "explore" ? selected : null }, "replace");
    assert();

    // Back and Forward land on an entry written before this road was tapped,
    // and that entry's URL says nothing about it. The panel does not follow
    // them — those buttons walk the route timeline, not the reading — so the
    // link is put back in step rather than left one press away from being
    // copied without the road it is about.
    window.addEventListener("popstate", assert);
    return () => window.removeEventListener("popstate", assert);
  }, [selected, mode]);

  // A link outlives the segments it was cut from. One naming a road that a
  // recut has since removed is let go rather than left pointing an empty panel
  // at nothing — the same thing `decodeStages` does with a stale ride.
  useEffect(() => {
    if (graph && selected && !graph.segments.has(selected)) setSelected(null);
  }, [graph, selected]);

  return [selected, setSelected];
}
