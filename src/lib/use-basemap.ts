import { useEffect, useState } from "react";
import type { MapRef } from "react-map-gl";
import {
  applyBasemap,
  BASEMAPS,
  DEFAULT_BASEMAP,
  type BasemapId,
} from "@/lib/basemap";

/** Kept in the browser, so a rider's choice of ground survives a reload and is
 *  the same ground on both maps. */
const STORE_KEY = "seaddle:map-theme";

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

/**
 * Which ground the maps are drawn on, remembered between visits.
 *
 * Held apart from the control that sets it, because the two are no longer in
 * the same place: the choice is made in a dialog and applied by whichever map
 * is on screen, and both maps want the same answer.
 */
export function useBasemapChoice(): [BasemapId, (id: BasemapId) => void] {
  const [choice, setChoice] = useState<BasemapId>(remembered);

  function choose(id: BasemapId) {
    setChoice(id);
    try {
      window.localStorage.setItem(STORE_KEY, id);
    } catch {
      // A lost preference is not worth an exception.
    }
  }

  return [choice, choose];
}

/**
 * Paint a chosen ground onto a map.
 *
 * Stays with the map rather than with the control, because it needs the mapbox
 * instance and the control only needs an id.
 */
export function useBasemapPaint(
  mapRef: React.RefObject<MapRef | null>,
  choice: BasemapId,
): void {
  const [ready, setReady] = useState(false);

  // Whether the ref is populated by the time this runs is react-map-gl's
  // business rather than a guarantee. Watching for it costs a frame or two and
  // removes the question.
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
}
