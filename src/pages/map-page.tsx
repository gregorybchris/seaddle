import { useCallback, useMemo, useState } from "react";
import { coordAtFraction } from "@/lib/geo/polyline";
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
  const [encoding, setEncoding] = useState<Encoding>("protection");

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
          onPick={pick}
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
