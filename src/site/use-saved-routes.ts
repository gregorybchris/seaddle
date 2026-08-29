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

/**
 * What a route ends up called when nobody typed anything.
 *
 * One place decides it, because the panel has to ask "is this name taken?"
 * about the name a route will actually be saved under — and an empty box that
 * became "Unnamed route" somewhere else would be checked against a name it was
 * never going to have.
 */
export function chosenName(name: string): string {
  return name.trim() || "Unnamed route";
}

/**
 * The saved route already answering to this name, if one does.
 *
 * Read the way a rider reads the list rather than the way a string compares:
 * trimmed and case-blind, because "Thursday commute" and "thursday commute "
 * are one name to anyone looking at two rows of it, and a list holding both is
 * a list they cannot choose from.
 *
 * `except` is the route asking — a row keeping its own name has not collided
 * with anything, and a route being saved again under the name it already has
 * is not about to replace itself.
 */
export function routeNamed(
  routes: SavedRoute[],
  name: string,
  except?: string,
): SavedRoute | undefined {
  const wanted = name.trim().toLocaleLowerCase();
  if (!wanted) return undefined;
  return routes.find(
    (saved) =>
      saved.id !== except && saved.name.trim().toLocaleLowerCase() === wanted,
  );
}

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

  /**
   * Keep this route under this name, replacing whatever held either before.
   *
   * Two ways a save can land on something already in the list, and both end the
   * same way — one row, not two. The same route saved twice is a rename, and a
   * name already spoken for is an overwrite, which the panel asks about before
   * calling this: a list with two "Thursday commute"s in it cannot be read, and
   * silently taking the second one is worse than either.
   */
  const save = useCallback((name: string, route: string) => {
    setRoutes((current) => {
      const chosen = chosenName(name);
      const replaced = routeNamed(current, chosen);
      const next: SavedRoute[] = [
        {
          id: `${Date.now()}`,
          name: chosen,
          route,
          savedAt: Date.now(),
        },
        ...current.filter(
          (saved) => saved.route !== route && saved.id !== replaced?.id,
        ),
      ];
      writeStoredJson(KEY, next);
      return next;
    });
  }, []);

  /**
   * A new name for a route already kept.
   *
   * The route itself does not move: a rider renaming "Untitled" to "Thursday
   * commute" is labelling the same route, and reordering the list under their
   * cursor would make the rename look like it saved a second copy.
   *
   * An empty name is not a name, and the row it was typed into would come back
   * blank with nothing to click on — so it leaves the old one standing rather
   * than reaching for a placeholder nobody chose.
   *
   * Taking a name another route is already using takes the route with it, the
   * same way saving over one does. The panel asks first.
   */
  const rename = useCallback((id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;

    setRoutes((current) => {
      const replaced = routeNamed(current, trimmed, id);
      const next = current
        .filter((saved) => saved.id !== replaced?.id)
        .map((saved) =>
          saved.id === id ? { ...saved, name: trimmed } : saved,
        );
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

  return { routes, save, rename, remove };
}
