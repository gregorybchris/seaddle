import { SeaddleMark } from "@/widgets/seaddle-mark";

/**
 * The site's name at the top of whichever panel is open.
 *
 * The same block in both, because it is the same block: the mark, the name, and
 * one line saying what this is. Building and exploring are two things to do
 * with one map, and a header that shifted between them would say they were two
 * sites.
 *
 * On a phone it doubles as the sheet's drag surface, which is why it is handed
 * to `header` rather than drawn inside the panel — see `Sheet`.
 */
export function PanelHeader() {
  return (
    <div className="flex items-center gap-3">
      <SeaddleMark className="text-sand h-8 w-8 shrink-0" />
      <div className="min-w-0 flex-1">
        <h1 className="text-sand text-base leading-none tracking-[0.18em] uppercase">
          Seaddle
        </h1>
        <p className="eyebrow text-sand/70 mt-1">Seattle cycling routes</p>
      </div>
    </div>
  );
}
