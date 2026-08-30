import { TreeEvergreen } from "@phosphor-icons/react";
import { Fragment } from "react";
import type { BasemapId } from "@/lib/basemap";
import { IS_MAC } from "@/lib/utilities/keys";
import { useUnits } from "@/lib/use-units";
import { UNIT_LABELS, UNIT_SYSTEMS } from "@/lib/utilities/units";
import { BasemapChoices } from "@/widgets/basemap-choices";
import { ChipGroup } from "@/widgets/chip-group";
import { Keycap } from "@/widgets/keycap";
import { SeaddleMark } from "@/widgets/seaddle-mark";
import { Switch } from "@/widgets/switch";
import type { Mode } from "../mode";

type SettingsPanelProps = {
  /** Which half of the key list applies right now. */
  mode: Mode;
  basemap: BasemapId;
  onBasemap: (id: BasemapId) => void;
  autoZoom: boolean;
  onAutoZoom: (on: boolean) => void;
};

/**
 * The three answers a rider gives once and then lives with.
 *
 * Which is the line this dialog is drawn on, and the reason the ground moved
 * here out of the color dialog next door: what the map is *colored by* is a
 * question about the segments and gets asked again whenever the rider wants to
 * know something else about them, while the ground under them, the units, and
 * whether the camera moves are all set once by taste and then forgotten. The
 * palette is a reading of the network; this is the shape of the site.
 *
 * The ground leads because it is the one anybody comes looking for — it is
 * visible, it is a matter of taste, and it changes the whole screen. Units and
 * the camera follow: both are set once, by someone who has already been
 * annoyed by the default.
 */
export function SettingsPanel({
  mode,
  basemap,
  onBasemap,
  autoZoom,
  onAutoZoom,
}: SettingsPanelProps) {
  const { system, choose } = useUnits();

  return (
    <div className="flex flex-col gap-4">
      {/* Its own heading, which the picker does not carry: it is one section of
          three here, while the admin opens it alone into a dialog that has
          already named it. */}
      <div className="flex flex-col gap-1.5">
        <span className="eyebrow text-sand/70">Map style</span>
        <BasemapChoices value={basemap} onChange={onBasemap} />
      </div>

      <div className="border-sand/10 border-t pt-4">
        {/* A joined bar rather than two chips: they are the two halves of one
            answer, and sharing an edge says so. */}
        <ChipGroup
          label="Units"
          joined
          options={UNIT_SYSTEMS}
          value={system}
          onChange={choose}
          labelFor={(unit) => UNIT_LABELS[unit]}
        />
      </div>

      <div className="border-sand/10 border-t pt-3">
        <Switch
          checked={autoZoom}
          onChange={onAutoZoom}
          label="Auto-zoom"
          hint="Automatically move the map to the segments you can select next."
        />
      </div>

      <Shortcuts mode={mode} />

      <Colophon />
    </div>
  );
}

/**
 * Every key the site answers, in the one dialog that is already the shape of
 * the site rather than a step in anything.
 *
 * A list of keys is the thing a rider looks up once and then never opens
 * again, which is the same shelf the ground and the units sit on. It earns a
 * place there because four of these keys are named nowhere else: a tooltip is
 * a hover, and the two that need explaining most — the bare rubout, and escape
 * — hang off no button at all.
 *
 * Route first, then map, which is the order the site itself is in: the panel
 * builds a route and the buttons in the corner change what it is read against.
 *
 * Only the keys the current mode answers. A key bound to a button that is not
 * on screen does nothing when it is pressed, and a list promising otherwise
 * teaches a rider that the shortcuts are unreliable rather than that they are
 * building or reading — the one key that switches between the two is on the
 * list in both.
 *
 * Not on a phone, where there is no keyboard to press any of them with and the
 * dialog has three real settings to get to.
 */
function Shortcuts({ mode }: { mode: Mode }) {
  const keys = SHORTCUTS.filter((key) => !key.mode || key.mode === mode);

  return (
    <div className="border-sand/10 hidden border-t pt-4 md:block">
      <span className="eyebrow text-sand/70">Keyboard</span>
      <ul className="mt-2.5 flex flex-col gap-2">
        {keys.map(({ chords, does }) => (
          <li key={does} className="flex items-center justify-between gap-3">
            <span className="text-sand/80 text-xs leading-snug">{does}</span>
            {/* Right-aligned and never wrapping: the keys are the column being
                scanned, and a cap that drops to its own line stops being one.
                A chord holds its caps close and the alternates stand apart, so
                two keys pressed together never read as two ways to do it. */}
            <span className="flex shrink-0 items-center gap-2">
              {chords.map((chord, at) => (
                <Fragment key={chord.join()}>
                  {at > 0 && (
                    <span className="text-sand/40 text-[0.625rem]">or</span>
                  )}
                  <span className="flex items-center gap-1">
                    {chord.map((key) => (
                      <Keycap key={key}>{key}</Keycap>
                    ))}
                  </span>
                </Fragment>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** What the two keys the platforms disagree about are called on this one. */
const CMD = IS_MAC ? "Cmd" : "Ctrl";
const RUBOUT = IS_MAC ? "Delete" : "Backspace";

/**
 * What each key does, in the words the button already uses where there is one
 * — a list of shortcuts is read down rather than across, and a sentence per
 * row makes that a paragraph.
 *
 * This is the only place the whole set is written down, and nothing reads it —
 * each key is bound beside the control it works, four files away from here:
 *
 * - `use-route-history.ts` — undo and redo, and the bare rubout that undoes.
 * - `route-panel.tsx` — the modified rubout that starts over.
 * - `map-controls.tsx` — mode, segment color, map style.
 * - `site-map.tsx` — escape, which deselects.
 *
 * So a key bound in one of those and left out of this list is a key nobody
 * finds. Change either end and change this one with it.
 *
 * A `mode` is the mode that key answers in, and it has to match the gate at
 * the binding — the three map keys answer in both and carry none.
 */
const SHORTCUTS: { chords: string[][]; does: string; mode?: Mode }[] = [
  { chords: [[CMD, "Z"], [RUBOUT]], does: "Undo", mode: "build" },
  // Both spellings of redo, because both are bound: ⌘⇧Z is what the button's
  // tooltip teaches, and ⌘Y is what a rider arriving from Windows presses
  // first. A key that answers and is not on this list is a key nobody finds.
  {
    chords: [
      [CMD, "Shift", "Z"],
      [CMD, "Y"],
    ],
    does: "Redo",
    mode: "build",
  },
  { chords: [[CMD, RUBOUT]], does: "Start over", mode: "build" },
  { chords: [["E"], ["M"]], does: "Switch mode" },
  { chords: [["C"]], does: "Next segment color" },
  { chords: [["T"]], does: "Next map style" },
  { chords: [["Esc"]], does: "Deselect", mode: "explore" },
];

/**
 * Who made this, at the foot of the one dialog nobody opens by accident.
 *
 * It belongs here rather than on the map or in the panel: a byline is worth
 * finding and not worth a permanent line of the screen, and someone who has
 * gone looking for the settings is already the person who wondered where this
 * came from. Set at the quietest weight on the page and given the mark for
 * company, so it reads as a signature rather than as a fourth setting.
 */
function Colophon() {
  return (
    <div className="border-sand/10 flex items-center gap-2.5 border-t pt-4">
      <SeaddleMark className="text-sand/30 h-7 w-7 shrink-0" />
      <div className="min-w-0">
        <p className="eyebrow text-sand/60">Seaddle</p>
        {/* The tree sits inside the sentence rather than beside it, on the
            text's own middle — it is the last word of "Made in Seattle", and a
            glyph hung off the end of the line would read as a control. */}
        <p className="text-sand/40 mt-0.5 flex items-center gap-1 text-[0.6875rem] leading-tight">
          {/* One flex item, not three: the gap belongs between the sentence
              and the tree, not around the link. */}
          <span>
            &copy; 2026{" "}
            {/* Faintly underlined rather than bare: a mailto with no
                affordance in a byline is a link nobody finds. */}
            <a
              href="mailto:christopher.b.gregory@gmail.com"
              className="decoration-sand/25 hover:text-sand/70 hover:decoration-sand/50 focus-visible:ring-blaze rounded-sm underline underline-offset-2 transition-colors focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none"
            >
              Chris Gregory
            </a>{" "}
            &middot; Made in Seattle
          </span>
          <TreeEvergreen
            aria-hidden
            weight="fill"
            className="h-3 w-3 shrink-0"
          />
        </p>
      </div>
    </div>
  );
}
