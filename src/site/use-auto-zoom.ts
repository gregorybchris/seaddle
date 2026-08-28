import { useState } from "react";
import { readStored, writeStored } from "@/lib/utilities/storage";

const STORE_KEY = "seaddle:auto-zoom";

/**
 * Whether the map moves itself to the next set of turnings after every pick.
 *
 * On by default, and on for almost everybody: a rider who has just added a road
 * is looking for what comes after it, and finding it means a pan and a zoom
 * they did not ask to do. But that camera move is also the site taking the map
 * away from someone who deliberately put it somewhere — zoomed into the
 * neighborhood they are actually planning through — and there was no way to say
 * so. Kept in the browser, like the mode and the choice of ground: nobody wants
 * to turn this off twice.
 */
export function useAutoZoom(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState<boolean>(() => readStored(STORE_KEY) !== "off");

  function choose(next: boolean) {
    setOn(next);
    writeStored(STORE_KEY, next ? "on" : "off");
  }

  return [on, choose];
}
