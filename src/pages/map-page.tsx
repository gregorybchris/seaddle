import { useCallback, useEffect, useMemo, useState } from "react";
import { coordAtFraction, sliceBetween } from "@/lib/geo/polyline";
import { cn } from "@/lib/utilities/style-utils";
import type { Coord } from "@/lib/models/geo";
import type { SegmentId } from "@/lib/models/graph";
import type { Scrub } from "@/widgets/elevation-profile";
import { SeaddleMark } from "@/widgets/seaddle-mark";
import { RoutePanel } from "@/site/components/route-panel";
import { SiteMap } from "@/site/components/site-map";
import type { Encoding } from "@/site/encoding";
import {
  append,
  EMPTY_ROUTE,
  isEmpty,
  riddenOrder,
  routePoints,
  startRoute,
} from "@/site/route";
import { pinsAlong } from "@/lib/graph/pins";
import { useBasemapChoice } from "@/lib/use-basemap";
import { MapControls } from "@/site/components/map-controls";
import { MapLegend } from "@/site/components/map-legend";
import { MapWatermark } from "@/site/components/map-watermark";
import { SHOW_TURNINGS } from "@/site/flags";
import { turnings } from "@/site/turnings";
import { SegmentPanel } from "@/site/components/segment-panel";
import { useMode } from "@/site/use-mode";
import { useGraph } from "@/site/use-graph";
import { useRouteHistory } from "@/site/use-route-history";
import { useAutoZoom } from "@/site/use-auto-zoom";
import { useSelection } from "@/site/use-selection";

export function MapPage() {
  const { graph, pins, error } = useGraph();
  /**
   * What a click on a segment does, and which segment is being read if it
   * reads.
   *
   * Exploring is where a rider arrives who has never said otherwise: the first
   * question a map of a strange city gets is what its lines are, not which of
   * them to chain. Anyone who has said otherwise arrives back where they left
   * off — the mode is kept in the browser like the choice of ground.
   *
   * Switching away leaves the route alone — it is still there on the map and
   * still there when the shovel comes back — so exploring costs nothing to step
   * into mid-route, which is exactly when the question it answers comes up.
   */
  const [mode, setMode] = useMode();
  /**
   * The route, and every route it was on the way here.
   *
   * Each move leaves a history entry too, so the back button keeps undoing —
   * free on a desktop, and where an Android thumb already is.
   *
   * The mode goes in because the keys it binds are build-mode keys: there is
   * no undoing a pick in a mode where nothing is being picked.
   */
  const {
    route,
    framing,
    change: changeRoute,
    load,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useRouteHistory(graph, mode);
  const [scrub, setScrub] = useState<Scrub | null>(null);
  /**
   * The segment being read, which the link carries so it can be sent to
   * someone. Kept across a trip into build mode and back, but only named in the
   * URL while exploring — see `use-selection`.
   */
  const [selected, setSelected] = useSelection(mode, graph);
  /**
   * What the map is colored by before anyone asks for something else.
   *
   * Steepness rather than grade: grade is the finer reading, but it is drawn as
   * a continuous ramp along each segment, and a rider opening the map is
   * deciding which segments to take rather than reading a hill. Three named
   * steps answer that at a glance.
   */
  const [encoding, setEncoding] = useState<Encoding>("steepness");
  const [basemap, setBasemap] = useBasemapChoice();
  const [autoZoom, setAutoZoom] = useAutoZoom();
  /**
   * The segment the panel is pointing at, and where the map is looking.
   *
   * Both exist so the list of segments in the panel and the lines on the map
   * are the same conversation: the map says which part of the city the list is
   * about, and the list says which segment on it is under the reader's
   * attention.
   */
  const [highlighted, setHighlighted] = useState<SegmentId | null>(null);
  const [center, setCenter] = useState<Coord | null>(null);

  /**
   * Only the list of segments reads where the map is looking, and this fires
   * every time the map settles — so with the list off there is a re-render here
   * for every pan and nothing on the other end of it.
   */
  const noteCenter = useCallback((coord: Coord) => {
    if (SHOW_TURNINGS) setCenter(coord);
  }, []);

  const pick = useCallback(
    (id: SegmentId) => {
      if (!graph) return;
      const segment = graph.segments.get(id);
      if (!segment) return;
      // `append` enforces the rules itself, so there is nothing to check here.
      changeRoute(
        isEmpty(route) ? startRoute(segment) : append(route, segment, graph),
      );
    },
    [graph, route, changeRoute],
  );

  const points = useMemo(
    () => (graph ? routePoints(route, graph) : []),
    [route, graph],
  );

  const reading = selected ? (graph?.segments.get(selected) ?? null) : null;

  /**
   * The place on the map the reader is pointing at on the elevation chart, and
   * the stretch of it they are dragging across.
   *
   * Measured along whatever the visible panel is charting — the whole route, or
   * the one segment being read. There are two charts, so which line the
   * fraction runs along has to follow which panel is open, or scrubbing one
   * segment would put the marker somewhere along a route nobody is looking at.
   *
   * The band is cut with the same `sliceBetween` the chart's caption measures
   * with, so the piece of road drawn on the map is the piece the numbers under
   * the chart are about — down to the interpolated ends.
   */
  const scrubbed = useMemo(() => {
    const charted = mode === "explore" ? (reading?.points ?? []) : points;
    if (scrub === null || charted.length < 2) return null;
    return {
      at: coordAtFraction(charted, scrub.at),
      band:
        scrub.from === null
          ? null
          : sliceBetween(charted, scrub.from, scrub.at),
    };
  }, [scrub, mode, reading, points]);

  // A fraction along one segment means nothing along the next, and the chart
  // only reports its own end of that when a pointer leaves it — which a finger
  // lifting off a phone does not reliably do.
  useEffect(() => setScrub(null), [selected, mode]);

  /** The pins on the segments chosen so far, in the order they are ridden
   *  past. */
  const routePins = useMemo(
    () => (graph ? pinsAlong(pins, riddenOrder(route, graph)) : []),
    [pins, route, graph],
  );

  /**
   * The segments that can be taken next, in words, for whoever is not clicking.
   *
   * Not worked out at all while the list is off: before a route starts it means
   * measuring the distance from the middle of the map to every segment in the
   * network, every time the map settles, for something nobody is going to see.
   */
  const choices = useMemo(
    () => (SHOW_TURNINGS && graph ? turnings(route, graph, center) : []),
    [route, graph, center],
  );

  if (error) return <Splash title="Map unavailable">{error}</Splash>;
  if (!graph) return <Splash title="Seaddle" waiting />;

  return (
    <div className="relative h-full md:flex">
      {mode === "explore" ? (
        <SegmentPanel segment={reading} onScrub={setScrub} />
      ) : (
        <RoutePanel
          graph={graph}
          route={route}
          encoding={encoding}
          onUndo={undo}
          onRedo={redo}
          canUndo={canUndo}
          canRedo={canRedo}
          onClear={() => changeRoute(EMPTY_ROUTE)}
          // A saved route is finished, so it is shown whole rather than framed
          // on wherever it could still go.
          onLoad={load}
          onScrub={setScrub}
          turnings={choices}
          onPick={pick}
          onHighlight={setHighlighted}
        />
      )}
      {/* The map's own box, and so the frame everything laid over it is
          positioned against — the controls read their state straight from here
          rather than being drilled through the map to reach it. */}
      <main className="relative h-full md:min-w-0 md:flex-1">
        <SiteMap
          graph={graph}
          route={route}
          mode={mode}
          encoding={encoding}
          basemap={basemap}
          autoZoom={autoZoom}
          scrubbed={scrubbed}
          allPins={pins}
          pins={routePins}
          framing={framing}
          highlighted={highlighted}
          selected={mode === "explore" ? selected : null}
          onPick={pick}
          onSelect={setSelected}
          onCenter={noteCenter}
        />

        <MapWatermark />
        {/* Under the mark on a phone, where the only free edge is; down with
            the map's own credits on desktop, where the sidebar has just ended
            and the top-left would read as belonging to it. */}
        <MapLegend
          encoding={encoding}
          className="absolute top-14 left-3 z-10 md:top-auto md:bottom-9"
        />
        <MapControls
          mode={mode}
          onMode={setMode}
          encoding={encoding}
          onEncoding={setEncoding}
          basemap={basemap}
          onBasemap={setBasemap}
          autoZoom={autoZoom}
          onAutoZoom={setAutoZoom}
        />
      </main>
    </div>
  );
}

function Splash({
  title,
  children,
  waiting = false,
}: {
  title: string;
  children?: React.ReactNode;
  waiting?: boolean;
}) {
  return (
    <div className="bg-forest flex h-full items-center justify-center p-8">
      <div className="flex max-w-sm flex-col items-center text-center">
        <SeaddleMark
          className={cn(
            "text-sand/80 mb-5 h-12 w-12",
            waiting && "animate-[breathe_1.8s_ease-in-out_infinite]",
          )}
        />
        <h1 className="text-sand text-lg tracking-[0.14em] uppercase">
          {title}
        </h1>
        {children && (
          <p className="text-sand/70 mt-3 text-sm leading-relaxed">
            {children}
          </p>
        )}
      </div>
    </div>
  );
}
