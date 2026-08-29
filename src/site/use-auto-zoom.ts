import { useState } from "react";
import { readStored, writeStored } from "@/lib/utilities/storage";

const STORE_KEY = "seaddle:auto-zoom";

/**
 * Whether the map moves itself to the next set of turnings after every pick.
 *
 * Off by default. It was on once, on the theory that a rider who has just added
 * a segment is looking for what comes after it — but that camera move is the
 * site taking the map away from someone who deliberately put it somewhere,
 * zoomed into the neighborhood they are actually planning through, and a map
 * that moves on its own is harder to trust than one that waits. The rider who
 * wants the follow can turn it on. Kept in the browser, like the mode and the
 * choice of ground: nobody wants to make that choice twice.
 */
export function useAutoZoom(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState<boolean>(() => readStored(STORE_KEY) === "on");

  function choose(next: boolean) {
    setOn(next);
    writeStored(STORE_KEY, next ? "on" : "off");
  }

  return [on, choose];
}
