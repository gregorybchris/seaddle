import { SeaddleMark } from "@/widgets/seaddle-mark";

/**
 * The site's name, on the map instead of in the panel.
 *
 * Mobile only. The panel there is a sheet showing about a fifth of the screen
 * at rest, and a title is the one thing on it that never changes — so it moves
 * to the corner of the map, where there is room going spare, and the sheet gets
 * the space back for what the rider just did.
 *
 * White with a traced dark outline rather than the sand it wears in the
 * sidebar: the corner it sits in is whatever the map puts there, and a dark
 * fill that reads on a pale road disappears over a park or a satellite tile.
 * `pointer-events-none` because it is a label and the roads underneath it are
 * the interface — a tap here has to reach the map.
 */
export function MapWatermark() {
  return (
    <div className="pointer-events-none absolute top-3 left-3 z-10 flex items-center gap-2 select-none md:hidden">
      <SeaddleMark className="outlined-mark h-7 w-7 shrink-0" />
      <div className="min-w-0">
        <h1 className="outlined-type text-sm leading-none tracking-[0.18em] uppercase">
          Seaddle
        </h1>
        <p className="eyebrow outlined-type outlined-type-fine mt-0.5 text-[0.5625rem]">
          Seattle cycling routes
        </p>
      </div>
    </div>
  );
}
