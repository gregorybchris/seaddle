import { useCallback, useMemo, useState } from "react";
import { coordAtFraction } from "@/lib/geo/polyline";
import type { SegmentId } from "@/lib/models/graph";
import { SeaddleMark } from "@/widgets/seaddle-mark";
import { RoutePanel } from "@/site/components/route-panel";
import { SiteMap } from "@/site/components/site-map";
import {
  append,
  EMPTY_ROUTE,
  routePoints,
  isEmpty,
  startRoute,
  undo,
  type Route,
} from "@/site/route";
import { useGraph } from "@/site/use-graph";

export function MapPage() {
  const { graph, error } = useGraph();
  const [route, setRoute] = useState<Route>(EMPTY_ROUTE);
  const [scrub, setScrub] = useState<number | null>(null);

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

  const pick = useCallback(
    (id: SegmentId) => {
      if (!graph) return;
      const segment = graph.segments.get(id);
      if (!segment) return;
      // `append` enforces the rules itself, so there is nothing to check here.
      setRoute((current) =>
        isEmpty(current)
          ? startRoute(segment)
          : append(current, segment, graph),
      );
    },
    [graph],
  );

  if (error) return <Splash title="Map unavailable">{error}</Splash>;
  if (!graph) return <Splash title="Seaddle" waiting />;

  return (
    <div className="relative h-full md:flex">
      <RoutePanel
        graph={graph}
        route={route}
        onUndo={() => setRoute(undo)}
        onClear={() => setRoute(EMPTY_ROUTE)}
        onScrub={setScrub}
      />
      <main className="h-full md:min-w-0 md:flex-1">
        <SiteMap
          graph={graph}
          route={route}
          scrubbed={scrubbed}
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
