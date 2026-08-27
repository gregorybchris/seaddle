import { useCallback, useState } from "react";
import type { SegmentId } from "@/lib/models/graph";
import { CycattleMark } from "@/widgets/cycattle-mark";
import { RoutePanel } from "@/site/components/route-panel";
import { SiteMap } from "@/site/components/site-map";
import {
  append,
  canAppend,
  EMPTY_ROUTE,
  isEmpty,
  startRoute,
  undo,
  type Route,
} from "@/site/route";
import { useGraph } from "@/site/use-graph";

export function MapPage() {
  const { graph, error } = useGraph();
  const [route, setRoute] = useState<Route>(EMPTY_ROUTE);

  const pick = useCallback(
    (id: SegmentId) => {
      if (!graph) return;
      const segment = graph.segments.get(id);
      if (!segment) return;
      setRoute((current) => {
        if (isEmpty(current)) return startRoute(segment);
        return canAppend(current, segment, graph)
          ? append(current, segment)
          : current;
      });
    },
    [graph],
  );

  if (error) return <Splash title="Map unavailable">{error}</Splash>;
  if (!graph) return <Splash title="Cycattle" waiting />;

  return (
    <div className="relative h-full md:flex">
      <RoutePanel
        graph={graph}
        route={route}
        onUndo={() => setRoute(undo)}
        onClear={() => setRoute(EMPTY_ROUTE)}
      />
      <main className="h-full md:min-w-0 md:flex-1">
        <SiteMap graph={graph} route={route} onPick={pick} />
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
        <CycattleMark
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
