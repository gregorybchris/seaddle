import { useCallback, useEffect, useState } from "react";
import { readStoredJson, writeStoredJson } from "@/lib/utilities/storage";
import { respell } from "./route";

const KEY = "seaddle.routes";

export type SavedRoute = {
  id: string;
  name: string;
  /** The route as it appears in a link. */
  route: string;
  savedAt: number;
};

export function useSavedRoutes() {
  const [routes, setRoutes] = useState<SavedRoute[]>([]);

  // Read after mounting rather than as the initial state: the list is only in
  // the browser, and reading it during the first render would be reading it
  // before there is one.
  //
  // Re-spelled on the way in. Each of these was written down in whatever
  // format the link used at the time, and one still in the old spelling would
  // never match the route the rider is currently looking at — so saving that
  // route again would list it twice instead of renaming the one already there.
  useEffect(
    () =>
      setRoutes(
        readStoredJson<SavedRoute[]>(KEY, []).map((saved) => ({
          ...saved,
          route: respell(saved.route),
        })),
      ),
    [],
  );

  const save = useCallback((name: string, route: string) => {
    setRoutes((current) => {
      // Saving the same route twice renames it rather than listing it twice.
      const next: SavedRoute[] = [
        {
          id: `${Date.now()}`,
          name: name.trim() || "Unnamed route",
          route,
          savedAt: Date.now(),
        },
        ...current.filter((saved) => saved.route !== route),
      ];
      writeStoredJson(KEY, next);
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setRoutes((current) => {
      const next = current.filter((saved) => saved.id !== id);
      writeStoredJson(KEY, next);
      return next;
    });
  }, []);

  return { routes, save, remove };
}
