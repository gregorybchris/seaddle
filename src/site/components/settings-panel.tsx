import { TreeEvergreen } from "@phosphor-icons/react";
import type { BasemapId } from "@/lib/basemap";
import { useUnits } from "@/lib/use-units";
import { UNIT_LABELS, UNIT_SYSTEMS } from "@/lib/utilities/units";
import { BasemapChoices } from "@/widgets/basemap-choices";
import { ChipGroup } from "@/widgets/chip-group";
import { SeaddleMark } from "@/widgets/seaddle-mark";
import { Switch } from "@/widgets/switch";

type SettingsPanelProps = {
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
 * question about the roads and gets asked again whenever the rider wants to
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
          hint="After each pick, move the map to the roads you can take next."
        />
      </div>

      <Colophon />
    </div>
  );
}

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
          &copy; 2026 Chris Gregory &middot; Made in Seattle
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
