import { Binoculars, GearSix, Palette, Shovel } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { BASEMAPS, type BasemapId } from "@/lib/basemap";
import { typingIn } from "@/lib/utilities/keys";
import { Dialog } from "@/widgets/dialog";
import { MapButton } from "@/widgets/map-button";
import { ENCODINGS, type Encoding } from "../encoding";
import type { Mode } from "../mode";
import { ColorPanel } from "./color-panel";
import { SettingsPanel } from "./settings-panel";

type MapControlsProps = {
  mode: Mode;
  onMode: (mode: Mode) => void;
  encoding: Encoding;
  onEncoding: (encoding: Encoding) => void;
  basemap: BasemapId;
  onBasemap: (id: BasemapId) => void;
  autoZoom: boolean;
  onAutoZoom: (on: boolean) => void;
};

/**
 * The controls that are not part of building a route, as buttons on the map.
 *
 * They are not in the panel because none of them is a step in anything: a rider
 * sets a color or a ground once and then spends the rest of the session picking
 * segments, with the controls for both taking up room the whole time. Behind a
 * button they cost nothing until they are wanted.
 *
 * The mode switch sits with them because it is the same kind of thing — set
 * once, then lived with — even though it is the one control here that changes
 * what a click on the map does rather than what the map looks like.
 *
 * Three, and there used to be a fourth. The filters went: they were a real
 * feature answering a real question, and almost nobody asked it — the segments
 * a beginner would have filtered out are already colored, already badged, and
 * already named in the breakdown of their own route, so the dialog was a second
 * way to learn what the map says at a glance. A control nobody opens is not
 * free; it is a button in the row that every other button has to be told apart
 * from.
 *
 * The two dialogs divide on how often the question comes back. Colors is what
 * the map is being asked about the segments, which changes as a rider's
 * question changes; settings is the shape of the site — ground, units, camera —
 * which is answered once. The ground moved across that line: it had been
 * sitting with colors because both were colors, which is a fact about the
 * implementation rather than about anyone using it.
 */
export function MapControls({
  mode,
  onMode,
  encoding,
  onEncoding,
  basemap,
  onBasemap,
  autoZoom,
  onAutoZoom,
}: MapControlsProps) {
  const [colorsOpen, setColorsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const exploring = mode === "explore";

  /**
   * The three buttons as three keys, bound beside them so they cannot drift.
   *
   * Each one steps its control on rather than opening what the button opens:
   * a dialog is worth its two clicks when a rider is choosing, and worth
   * nothing when they already know they want the next answer along. The
   * coloring is the one asked repeatedly — steepness to read a hill, then
   * protection to read the same segment for nerve — and stepping it is how that
   * question gets asked without a dialog opening and closing between answers.
   *
   * Forward only, and around. A reverse on the shift key would be four more
   * lines for a fourth press, which is the whole way around a list of four.
   *
   * Unmodified letters, so they stand aside while someone is naming a route,
   * and a dialog holds focus while it is open — a ground changing behind one
   * is a change nobody can see happen.
   */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (typingIn(event.target)) return;
      if (
        event.target instanceof HTMLElement &&
        event.target.closest('[role="dialog"]')
      )
        return;

      const key = event.key.toLowerCase();
      if (key === "e") onMode(exploring ? "build" : "explore");
      else if (key === "c") onEncoding(next(ENCODINGS, encoding));
      else if (key === "t") onBasemap(next(BASEMAP_IDS, basemap));
      else return;

      event.preventDefault();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [exploring, encoding, basemap, onMode, onEncoding, onBasemap]);

  return (
    <>
      <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
        {/* The mode the map is in, not the one a press would reach. It sits
            beside two buttons that open something and then close again, and
            this one does not — so it has to say which of the two answers a
            click on a segment is currently getting. The label carries both — the
            mode and what a press would do — rather than the icon saying one
            and `aria-pressed` the other, which is the arrangement that leaves
            a screen reader hearing "explore, pressed" while the map builds. */}
        <MapButton
          aria-label={
            exploring
              ? "Exploring segments. Switch to building a route."
              : "Building a route. Switch to exploring segments."
          }
          title={
            exploring
              ? "Explore mode (E to build)"
              : "Build mode (E to explore)"
          }
          onClick={() => onMode(exploring ? "build" : "explore")}
        >
          {exploring ? (
            <Binoculars size={17} weight="bold" />
          ) : (
            <Shovel size={17} weight="bold" />
          )}
        </MapButton>
        <MapButton
          aria-label="Segment color"
          title="Segment color (C)"
          aria-haspopup="dialog"
          onClick={() => setColorsOpen(true)}
        >
          <Palette size={17} weight="bold" />
        </MapButton>
        <MapButton
          aria-label="Settings"
          title="Settings"
          aria-haspopup="dialog"
          onClick={() => setSettingsOpen(true)}
        >
          <GearSix size={17} weight="bold" />
        </MapButton>
      </div>

      <Dialog
        open={colorsOpen}
        onOpenChange={setColorsOpen}
        title="Segment color"
      >
        <ColorPanel value={encoding} onChange={onEncoding} />
      </Dialog>

      <Dialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        title="Settings"
      >
        <SettingsPanel
          basemap={basemap}
          onBasemap={onBasemap}
          autoZoom={autoZoom}
          onAutoZoom={onAutoZoom}
        />
      </Dialog>
    </>
  );
}

/** The grounds in the order the picker offers them, which is the order T walks. */
const BASEMAP_IDS = BASEMAPS.map((basemap) => basemap.id);

/** The next value along, wrapping — and the first one back if the current
 *  value somehow is not in the list. */
function next<T>(values: T[], current: T): T {
  return values[(values.indexOf(current) + 1) % values.length];
}
