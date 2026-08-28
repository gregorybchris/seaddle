import { Binoculars, GearSix, Palette, Shovel } from "@phosphor-icons/react";
import { useState } from "react";
import type { BasemapId } from "@/lib/basemap";
import { Dialog } from "@/widgets/dialog";
import { MapButton } from "@/widgets/map-button";
import type { Encoding } from "../encoding";
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
 * roads, with the controls for both taking up room the whole time. Behind a
 * button they cost nothing until they are wanted.
 *
 * The mode switch sits with them because it is the same kind of thing — set
 * once, then lived with — even though it is the one control here that changes
 * what a click on the map does rather than what the map looks like.
 *
 * Three, and there used to be a fourth. The filters went: they were a real
 * feature answering a real question, and almost nobody asked it — the roads a
 * beginner would have filtered out are already colored, already badged, and
 * already named in the breakdown of their own ride, so the dialog was a second
 * way to learn what the map says at a glance. A control nobody opens is not
 * free; it is a button in the row that every other button has to be told apart
 * from.
 *
 * The two dialogs divide on how often the question comes back. Colors is what
 * the map is being asked about the roads, which changes as a rider's question
 * changes; settings is the shape of the site — ground, units, camera — which
 * is answered once. The ground moved across that line: it had been sitting with
 * colors because both were colors, which is a fact about the implementation
 * rather than about anyone using it.
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

  return (
    <>
      <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
        {/* The mode the map is in, not the one a press would reach. It sits
            beside two buttons that open something and then close again, and
            this one does not — so it has to say which of the two answers a
            click on a road is currently getting. The label carries both — the
            mode and what a press would do — rather than the icon saying one
            and `aria-pressed` the other, which is the arrangement that leaves
            a screen reader hearing "explore, pressed" while the map builds. */}
        <MapButton
          aria-label={
            exploring
              ? "Exploring roads. Switch to building a route."
              : "Building a route. Switch to exploring roads."
          }
          title={exploring ? "Explore mode" : "Build mode"}
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
          title="Segment color"
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
