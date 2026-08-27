import { useCallback, useMemo, useState } from "react";
import { coordAtFraction } from "@/lib/geo/polyline";
import type { Coord } from "@/lib/models/geo";
import type { SegmentId } from "@/lib/models/graph";
import { SeaddleMark } from "@/widgets/seaddle-mark";
import { RoutePanel } from "@/site/components/route-panel";
import { SiteMap } from "@/site/components/site-map";
import {
  NO_FILTERS,
  passes,
  type Encoding,
  type Filters,
} from "@/site/filters";
import {
  append,
  EMPTY_ROUTE,
  isEmpty,
  outAndBack,
  routePoints,
  startRoute,
} from "@/site/route";
import { pinsAlong } from "@/lib/graph/pins";
import { SHOW_TURNINGS } from "@/site/flags";
import { turnings } from "@/site/turnings";
import { useGraph } from "@/site/use-graph";
import { useRouteHistory } from "@/site/use-route-history";

export function MapPage() {
  const { graph, pins, error } = useGraph();
  /**
   * The route, and every route it was on the way here.
   *
   * Each move leaves a history entry too, so the back button keeps undoing —
   * free on a desktop, and where an Android thumb already is.
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
  } = useRouteHistory(graph);
  const [scrub, setScrub] = useState<number | null>(null);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [encoding, setEncoding] = useState<Encoding>("grade");
  /**
   * The road the panel is pointing at, and where the map is looking.
   *
   * Both exist so the list of roads in the panel and the lines on the map are
   * the same conversation: the map says which part of the city the list is
   * about, and the list says which road on it is under the reader's attention.
   */
  const [highlighted, setHighlighted] = useState<SegmentId | null>(null);
  const [center, setCenter] = useState<Coord | null>(null);

  /**
   * Only the list of roads reads where the map is looking, and this fires every
   * time the map settles — so with the list off there is a re-render here for
   * every pan and nothing on the other end of it.
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

  /** The place on the map the reader is pointing at on the elevation chart. */
  const scrubbed = useMemo(
    () =>
      scrub === null || points.length < 2
        ? null
        : coordAtFraction(points, scrub),
    [scrub, points],
  );

  /** The pins on the roads chosen so far, in the order they are ridden past. */
  const routePins = useMemo(
    () =>
      pinsAlong(
        pins,
        route.steps.map((step) => ({
          segment: step.segment,
          reversed: graph?.segments.get(step.segment)?.from !== step.from,
        })),
      ),
    [pins, route, graph],
  );

  /**
   * The roads that can be taken next, in words, for whoever is not clicking.
   *
   * Not worked out at all while the list is off: before a ride starts it means
   * measuring the distance from the middle of the map to every road in the
   * network, every time the map settles, for something nobody is going to see.
   */
  const choices = useMemo(
    () => (SHOW_TURNINGS && graph ? turnings(route, graph, center) : []),
    [route, graph, center],
  );

  const dimmed = useMemo(
    () =>
      graph
        ? [...graph.segments.values()]
            .filter((segment) => !passes(segment, filters))
            .map((segment) => segment.id)
        : [],
    [graph, filters],
  );

  if (error) return <Splash title="Map unavailable">{error}</Splash>;
  if (!graph) return <Splash title="Seaddle" waiting />;

  return (
    <div className="relative h-full md:flex">
      <RoutePanel
        graph={graph}
        route={route}
        encoding={encoding}
        onEncoding={setEncoding}
        filters={filters}
        onFilters={setFilters}
        passing={graph.segments.size - dimmed.length}
        total={graph.segments.size}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        onClear={() => changeRoute(EMPTY_ROUTE)}
        onOutAndBack={() => changeRoute(outAndBack(route))}
        // A saved ride is finished, so it is shown whole rather than framed
        // on wherever it could still go.
        onLoad={load}
        onScrub={setScrub}
        turnings={choices}
        onPick={pick}
        onHighlight={setHighlighted}
      />
      <main className="h-full md:min-w-0 md:flex-1">
        <SiteMap
          graph={graph}
          route={route}
          encoding={encoding}
          dimmed={dimmed}
          scrubbed={scrubbed}
          allPins={pins}
          pins={routePins}
          framing={framing}
          highlighted={highlighted}
          onPick={pick}
          onCenter={noteCenter}
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
          className={
            waiting
              ? "text-sand/80 mb-5 h-12 w-12 animate-[breathe_1.8s_ease-in-out_infinite]"
              : "text-sand/80 mb-5 h-12 w-12"
          }
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
