import { CaretDown, Check, Palette } from "@phosphor-icons/react";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { useEffect, useState } from "react";
import type { MapRef } from "react-map-gl";
import {
  applyBasemap,
  BASEMAPS,
  DEFAULT_BASEMAP,
  type BasemapId,
} from "@/lib/basemap";
import { cn } from "@/lib/utilities/style-utils";

/**
 * The basemap switch, collapsed to a single button until it is wanted.
 *
 * Shaped after Mapbox's own attribution toggle in the opposite corner: a button
 * that stays put while the panel grows out sideways from under it. A map has
 * room for exactly one thing at a time, and a rider who never touches this
 * should only ever see the button.
 */
type MapThemeProps = {
  mapRef: React.RefObject<MapRef | null>;
  className?: string;
};

/** Kept in the browser, so a rider's choice of ground survives a reload and is
 *  the same ground on both maps. */
const STORE_KEY = "seaddle:map-theme";

/**
 * How the pieces of this control are ranked against each other.
 *
 * Only one thing here gets the full `Button` treatment — a defined edge and a
 * hard offset shadow — and it is whichever surface is floating over the map.
 * The panel is that surface; the trigger sits inside it and so gets a fill
 * instead, because an identical border inside an identical border reads as a
 * box in a box rather than as a control in a panel. The menu is a second
 * floating surface, so it earns the full treatment again.
 */
const PANEL =
  "border-forest-deep bg-paper text-ink rounded-lg border-2 shadow-[2px_2px_0_var(--color-forest-deep)]";

const FLOATING_MENU =
  "border-forest-deep bg-paper text-ink rounded-lg border-2 p-1 shadow-[3px_3px_0_0_var(--color-forest-deep)]";

/** Nested in the panel: a filled chip, pressed by darkening rather than by
 *  dropping into a shadow it does not have. */
const NESTED_CONTROL =
  "bg-sand/50 hover:bg-sand/80 active:bg-sand rounded-md " +
  "transition-colors duration-150 ease-[var(--ease-settle)] motion-reduce:transition-none " +
  "focus-visible:ring-forest focus-visible:ring-2 focus-visible:outline-none";

function remembered(): BasemapId {
  try {
    const saved = window.localStorage.getItem(STORE_KEY);
    if (BASEMAPS.some((basemap) => basemap.id === saved)) {
      return saved as BasemapId;
    }
  } catch {
    // A browser refusing storage is not a reason to lose the map.
  }
  return DEFAULT_BASEMAP;
}

export function MapTheme({ mapRef, className }: MapThemeProps) {
  const [choice, setChoice] = useState<BasemapId>(remembered);
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [ready, setReady] = useState(false);

  const current =
    BASEMAPS.find((basemap) => basemap.id === choice) ?? BASEMAPS[0];

  function remember(picked: BasemapId) {
    setChoice(picked);
    try {
      window.localStorage.setItem(STORE_KEY, picked);
    } catch {
      // A browser refusing storage is not a reason to lose the choice itself.
    }
  }

  // The map is a sibling in the same commit, so whether the ref is populated by
  // the time this runs is react-map-gl's business rather than a guarantee.
  // Watching for it costs a frame or two and removes the question.
  useEffect(() => {
    if (ready) return;
    let frame = 0;
    const look = () => {
      if (mapRef.current?.getMap()) setReady(true);
      else frame = requestAnimationFrame(look);
    };
    look();
    return () => cancelAnimationFrame(frame);
  }, [ready, mapRef]);

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    let dropped = false;
    const apply = () => {
      if (dropped) return;
      const chosen = BASEMAPS.find((basemap) => basemap.id === choice);
      if (!chosen) return;
      try {
        // Every theme writes the same set of properties, so a switch leaves no
        // residue from the one before and none of this needs a style reload —
        // the ground changes under a map that never moves.
        applyBasemap(map, chosen);
      } catch (error) {
        // This runs straight from an effect, so an exception here unmounts the
        // tree and the rider gets a white screen instead of a map. A ground
        // that failed to repaint is worth strictly less than the map itself.
        console.error(`could not apply the ${chosen.id} basemap`, error);
      }
    };

    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);

    return () => {
      dropped = true;
      map.off("load", apply);
    };
  }, [choice, ready, mapRef]);

  return (
    <div
      className={cn(
        PANEL,
        "absolute top-3 right-3 z-10 flex h-9 flex-row-reverse items-center overflow-hidden",
        // The panel is clipped off its left edge rather than unmounted, which is
        // what lets it slide back under the button instead of blinking away.
        // Row-reverse is what puts the clipped edge on that side.
        "transition-[max-width] duration-300 ease-[var(--ease-settle)] motion-reduce:transition-none",
        open ? "max-w-[17rem]" : "max-w-9",
        className,
      )}
      onKeyDown={(event) => {
        // Escape belongs to the menu while the menu has it; folding the panel
        // away underneath an open list would take two things at once.
        if (event.key === "Escape" && !menuOpen) setOpen(false);
      }}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-label={open ? "Hide map theme" : "Change map theme"}
        onClick={() => setOpen((was) => !was)}
        className="focus-visible:ring-forest text-forest-deep hover:bg-sand/35 grid h-full w-8 shrink-0 place-items-center transition-colors focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none"
      >
        <Palette size={17} weight="bold" />
      </button>

      {/* Held out of the tab order and off the screen reader while it is folded
          away, so the button is genuinely the only control until it is opened. */}
      <div
        inert={!open}
        className="flex shrink-0 items-center gap-2 pr-2 pl-2.5 whitespace-nowrap"
      >
        <span className="eyebrow text-forest text-[0.6875rem]">Map theme</span>

        <Menu.Root open={menuOpen} onOpenChange={setMenuOpen}>
          <Menu.Trigger
            // Naming it outright rather than leaving the label to the eyebrow
            // beside it, which is not associated with the button. A bare
            // `aria-label="Map theme"` would be worse than none: it replaces the
            // trigger's own text, so the current theme would stop being read.
            aria-label={`Map theme: ${current.name}`}
            className={cn(
              NESTED_CONTROL,
              "group flex items-center gap-1.5 py-1 pr-1.5 pl-2 text-xs",
            )}
          >
            {current.name}
            <CaretDown
              size={10}
              weight="bold"
              aria-hidden
              className="text-forest transition-transform duration-200 ease-[var(--ease-settle)] group-data-[state=open]:rotate-180 motion-reduce:transition-none"
            />
          </Menu.Trigger>

          {/* Portalled, so the list is not clipped by the panel it opens from —
              the panel has to hide its own overflow to slide away at all. */}
          <Menu.Portal>
            <Menu.Content
              sideOffset={6}
              align="end"
              className={cn(FLOATING_MENU, "menu-panel z-50")}
            >
              <Menu.RadioGroup
                value={choice}
                onValueChange={(picked) => remember(picked as BasemapId)}
                className="flex flex-col gap-0.5"
              >
                {BASEMAPS.map((basemap) => (
                  <Menu.RadioItem
                    key={basemap.id}
                    value={basemap.id}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-md py-1.5 pr-2 pl-1.5 text-xs select-none",
                      "data-[highlighted]:bg-sand/70 outline-none",
                      "data-[state=checked]:text-forest-deep data-[state=checked]:font-medium",
                    )}
                  >
                    {/* A fixed slot rather than a conditional one, so the names
                        stay in a column instead of shifting as the tick moves. */}
                    <span className="grid w-3 place-items-center">
                      <Menu.ItemIndicator>
                        <Check size={11} weight="bold" />
                      </Menu.ItemIndicator>
                    </span>
                    {basemap.name}
                  </Menu.RadioItem>
                ))}
              </Menu.RadioGroup>
            </Menu.Content>
          </Menu.Portal>
        </Menu.Root>
      </div>
    </div>
  );
}
