import { useCallback, useEffect, useRef, useState } from "react";
import { typingIn } from "@/lib/utilities/keys";
import type { SiteGraph } from "./graph-data";
import { readLink, writeLink } from "./link";
import { decodeStages, EMPTY_ROUTE, encodeRoute, type Route } from "./route";

/**
 * What the map should frame next.
 *
 * Building a route and looking at one want different views: mid-build the
 * question is where to turn, but a route opened from a link or from the saved
 * list is finished, and the answer is what it looks like end to end.
 */
export type Framing = { mode: "choices" | "route"; at: number };

/**
 * Every route the rider has been through, and where along them they are now.
 *
 * Held as one list rather than as a past and a future, because that is what an
 * undone route is: still on the list, just behind the cursor. Making a new
 * choice from there drops everything ahead, the same way taking a different
 * turning means the segment you were on is no longer where you are going.
 */
type Timeline = { entries: Route[]; index: number };

const START: Timeline = { entries: [EMPTY_ROUTE], index: 0 };

/**
 * The route, and the ability to take back what made it.
 *
 * There is one history here, not two. Every move writes a browser entry
 * carrying its place on the timeline, so Back and Forward walk the same list
 * that the buttons and ⌘Z walk — a rider who undoes with the buttons and then
 * reaches for Back gets the next sensible thing, not a second stack quietly
 * disagreeing with the first.
 */
export function useRouteHistory(graph: SiteGraph | null) {
  const [timeline, setTimeline] = useState<Timeline>(START);
  const [framing, setFraming] = useState<Framing>({ mode: "route", at: 0 });

  // The listeners below outlive any one render, and a stale timeline would
  // have them undo from wherever the rider was several clicks ago.
  const live = useRef(timeline);

  const go = useCallback(
    (next: Timeline, mode: Framing["mode"], write: "push" | "replace") => {
      live.current = next;
      setTimeline(next);
      setFraming({ mode, at: Date.now() });

      // Only the route: whichever segment is being read is the selection's to
      // write, and it survives a pick rather than being cleared by one.
      writeLink({ route: encodeRoute(next.entries[next.index]) }, write, {
        index: next.index,
      });
    },
    [],
  );

  /** A new route, which is now the end of the story: anything undone is gone. */
  const change = useCallback(
    (route: Route, mode: Framing["mode"] = "choices") => {
      const { entries, index } = live.current;
      go(
        { entries: [...entries.slice(0, index + 1), route], index: index + 1 },
        mode,
        "push",
      );
    },
    [go],
  );

  /**
   * A route that was built elsewhere — a link, or one off the saved list.
   *
   * It arrives with its decisions intact, so it is unpacked into a timeline
   * rather than dropped on as a single lump. Undo then trims the last turn of
   * a shared route, which is the obvious thing to want to do with one.
   */
  const adopt = useCallback(
    (encoded: string, write: "push" | "replace") => {
      if (!graph) return;
      const entries = decodeStages(encoded, graph);
      go({ entries, index: entries.length - 1 }, "route", write);
    },
    [graph, go],
  );

  const step = useCallback(
    (by: 1 | -1) => {
      const { entries, index } = live.current;
      const next = index + by;
      if (next < 0 || next >= entries.length) return;
      go({ entries, index: next }, "choices", "push");
    },
    [go],
  );

  const undo = useCallback(() => step(-1), [step]);
  const redo = useCallback(() => step(1), [step]);

  // Read the link once the graph is there to make sense of it, and again
  // whenever Back or Forward moves through the history we have been writing.
  useEffect(() => {
    if (!graph) return;

    const restore = () => {
      const encoded = readLink().route;
      const { entries } = live.current;
      const index = (window.history.state as { index?: number } | null)?.index;

      // Somewhere we have already been: move the cursor and leave the timeline
      // alone, so Back is an undo and Forward is a redo. The URL has to agree
      // as well as the number — a reload keeps the browser's entries but not
      // ours, and then the same index means something else entirely.
      if (
        typeof index === "number" &&
        index >= 0 &&
        index < entries.length &&
        encodeRoute(entries[index]) === encoded
      ) {
        live.current = { entries, index };
        setTimeline(live.current);
        setFraming({ mode: "choices", at: Date.now() });
        return;
      }

      adopt(encoded, "replace");
    };

    restore();
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, [graph, adopt]);

  // ⌘Z and ⌘⇧Z, and their control-key spellings elsewhere. Bound here rather
  // than in the panel so the keys cannot drift from the buttons. ⌘Z belongs to
  // the text field while someone is in one.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (typingIn(event.target)) return;

      // ⌫ on its own, which is what every other route builder spells as "take
      // back the last segment" — and what a rider who has never met ⌘Z reaches
      // for first. Starting over wears the same key with a modifier, so the
      // habit lands on the reversible one. Undo, redo and this one are listed
      // in `SHORTCUTS` in the settings dialog: bind a key here, name it there.
      if (
        event.key === "Backspace" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey
      ) {
        event.preventDefault();
        undo();
        return;
      }

      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;

      const key = event.key.toLowerCase();
      const redoing = key === "y" || (key === "z" && event.shiftKey);
      if (key !== "z" && !redoing) return;

      event.preventDefault();
      if (redoing) redo();
      else undo();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  return {
    route: timeline.entries[timeline.index],
    framing,
    change,
    load: useCallback((encoded: string) => adopt(encoded, "push"), [adopt]),
    undo,
    redo,
    canUndo: timeline.index > 0,
    canRedo: timeline.index < timeline.entries.length - 1,
  };
}
