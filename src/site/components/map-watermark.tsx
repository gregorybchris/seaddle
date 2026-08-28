import { SeaddleMark } from "@/widgets/seaddle-mark";

/**
 * The site's name, on the map instead of in the panel.
 *
 * Mobile only. The panel there is a sheet showing about a fifth of the screen
 * at rest, and a title is the one thing on it that never changes — so it moves
 * to the corner of the map, where there is room going spare, and the sheet gets
 * the space back for what the rider just did.
 *
 * Forest rather than the sand it wears in the sidebar: every ground it can sit
 * on is near-white. `pointer-events-none` because it is a label and the roads
 * underneath it are the interface — a tap here has to reach the map.
 */
export function MapWatermark() {
  return (
    <div className="pointer-events-none absolute top-3 left-3 z-10 flex items-center gap-2 select-none md:hidden">
      <SeaddleMark className="text-forest-deep h-7 w-7 shrink-0 drop-shadow-[0_1px_2px_rgba(250,247,241,0.9)]" />
      <div className="min-w-0">
        <h1 className="text-forest-deep text-sm leading-none tracking-[0.18em] uppercase drop-shadow-[0_1px_2px_rgba(250,247,241,0.9)]">
          Seaddle
        </h1>
        <p className="eyebrow text-forest/80 mt-0.5 text-[0.5625rem] drop-shadow-[0_1px_2px_rgba(250,247,241,0.9)]">
          Seattle cycling routes
        </p>
      </div>
    </div>
  );
}
