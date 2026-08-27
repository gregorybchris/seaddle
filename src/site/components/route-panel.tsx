import { ArrowUUpLeft, Trash } from "@phosphor-icons/react";
import { cn } from "@/lib/utilities/style-utils";
import { formatFeet, formatMiles } from "@/lib/utilities/units";
import { Button } from "@/widgets/button";
import { CycattleMark } from "@/widgets/cycattle-mark";
import { ElevationProfile } from "@/widgets/elevation-profile";
import { Sheet } from "@/widgets/sheet";
import type { SiteGraph } from "../graph-data";
import {
  continuations,
  isEmpty,
  routeGain,
  routeMeters,
  routePoints,
  stepGain,
  type Route,
} from "../route";

type RoutePanelProps = {
  graph: SiteGraph;
  route: Route;
  onUndo: () => void;
  onClear: () => void;
};

export function RoutePanel({ graph, route, onUndo, onClear }: RoutePanelProps) {
  const meters = routeMeters(route, graph);
  const gain = routeGain(route, graph);
  const started = !isEmpty(route);
  const stuck = started && continuations(route, graph).size === 0;

  return (
    <Sheet
      raisedWhen={started}
      peek={
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <CycattleMark className="text-sand h-8 w-8 shrink-0" />
            <h1 className="text-sand flex-1 text-base leading-none tracking-[0.18em] uppercase">
              Cycattle
            </h1>
          </div>

          {/* Dimmed until there is a ride, so the zeros read as "not yet"
              rather than as a measurement. */}
          <div
            className={cn(
              "border-sand/10 flex items-end gap-6 border-t pt-3 transition-opacity duration-300",
              started ? "opacity-100" : "opacity-40",
            )}
          >
            <Figure label="distance" value={formatMiles(meters)} />
            <Figure
              label="climbing"
              value={
                gain.min === gain.max
                  ? formatFeet(gain.max)
                  : // One segment has no direction yet, and the two answers can
                    // differ by hundreds of feet.
                    `${Math.round(gain.min * 3.28084)}–${formatFeet(gain.max)}`
              }
            />
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        {started ? (
          <>
            <ElevationProfile points={routePoints(route, graph)} />

            {stuck && (
              <p className="border-blaze/40 bg-blaze/10 text-blaze rounded-lg border px-3 py-2 text-xs leading-relaxed">
                This is as far as the map goes that way. Step back and try
                another turn.
              </p>
            )}

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={onUndo}>
                <ArrowUUpLeft weight="bold" className="h-4 w-4" />
                Step back
              </Button>
              <Button variant="quiet" onClick={onClear} aria-label="Start over">
                <Trash weight="bold" className="h-4 w-4" />
              </Button>
            </div>

            <ol className="flex flex-col">
              {route.steps.map((step, index) => {
                const segment = graph.segments.get(step.segment);
                if (!segment) return null;
                return (
                  <li
                    key={`${step.segment}-${index}`}
                    className="border-sand/10 flex items-baseline gap-3 border-b py-2 last:border-b-0"
                  >
                    <span className="tabular text-sand/30 w-4 text-[0.625rem]">
                      {index + 1}
                    </span>
                    <span className="tabular text-sand flex-1 text-xs">
                      {formatMiles(segment.meters)}
                    </span>
                    <span className="tabular text-sand/45 text-[0.6875rem]">
                      ↑{formatFeet(stepGain(step, segment))}
                    </span>
                  </li>
                );
              })}
            </ol>
          </>
        ) : (
          <p className="text-sand/75 text-sm leading-relaxed">
            Tap any road to start a ride. From there, only the roads it connects
            to stay lit — keep tapping to build a route as long as you want it.
          </p>
        )}
      </div>
    </Sheet>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className={cn("flex flex-col gap-0.5")}>
      <span className="tabular text-sand text-xl leading-none">{value}</span>
      <span className="eyebrow text-sand/45">{label}</span>
    </div>
  );
}
