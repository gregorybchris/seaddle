import { useCallback, useEffect, useMemo, useState } from "react";
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
  decodeRoute,
  EMPTY_ROUTE,
  encodeRoute,
  isEmpty,
  outAndBack,
  routePoints,
  startRoute,
  undo,
  type Route,
} from "@/site/route";
import { pinsAlong } from "@/lib/graph/pins";
import { useGraph } from "@/site/use-graph";

/** The route lives in the address bar, so a link is the whole ride. */
function routeFromUrl(): string {
  return new URLSearchParams(window.location.search).get("r") ?? "";
}

export function MapPage() {
  const { graph, pins, error } = useGraph();
  const [route, setRouteState] = useState<Route>(EMPTY_ROUTE);
  const [scrub, setScrub] = useState<number | null>(null);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [encoding, setEncoding] = useState<Encoding>("laneQuality");
  /**
   * What the map should frame next.
   *
   * Building a route and looking at one want different views: mid-build the
   * question is where to turn, but a ride opened from a link or from the saved
   * list is finished, and the answer is what it looks like end to end.
   */
  const [framing, setFraming] = useState<{
    mode: "choices" | "route";
    at: number;
  }>({ mode: "route", at: 0 });

  // Read the link once the graph is there to make sense of it, and again
  // whenever the back button moves through the history we have been writing.
  useEffect(() => {
    if (!graph) return;
    const fromUrl = () => {
      setRouteState(decodeRoute(routeFromUrl(), graph));
      setFraming({ mode: "route", at: Date.now() });
    };
    fromUrl();
    window.addEventListener("popstate", fromUrl);
    return () => window.removeEventListener("popstate", fromUrl);
  }, [graph]);

  /**
   * Every change goes through here and leaves a history entry, which is what
   * makes the back button undo — free on a desktop, and where an Android
   * thumb already is.
   */
  const changeRoute = useCallback(
    (next: Route, mode: "choices" | "route" = "choices") => {
      setRouteState(next);
      setFraming({ mode, at: Date.now() });
      const encoded = encodeRoute(next);
      window.history.pushState(
        null,
        "",
        encoded ? `?r=${encoded}` : window.location.pathname,
      );
    },
    [],
  );

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
        onUndo={() => changeRoute(undo(route))}
        onClear={() => changeRoute(EMPTY_ROUTE)}
        onOutAndBack={() => changeRoute(outAndBack(route))}
        // A saved ride is finished, so it is shown whole rather than framed
        // on wherever it could still go.
        onLoad={(encoded) => changeRoute(decodeRoute(encoded, graph), "route")}
        onScrub={setScrub}
        pins={routePins}
      />
      <main className="h-full md:min-w-0 md:flex-1">
        <SiteMap
          graph={graph}
          route={route}
          encoding={encoding}
          dimmed={dimmed}
          scrubbed={scrubbed}
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
