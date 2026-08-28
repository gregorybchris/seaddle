import { useCallback, useEffect, useState } from "react";
import { readStoredJson, writeStoredJson } from "@/lib/utilities/storage";

const KEY = "seaddle.rides";

export type SavedRide = {
  id: string;
  name: string;
  /** The route as it appears in a link. */
  route: string;
  savedAt: number;
};

export function useSavedRides() {
  const [rides, setRides] = useState<SavedRide[]>([]);

  // Read after mounting rather than as the initial state: the list is only in
  // the browser, and reading it during the first render would be reading it
  // before there is one.
  useEffect(() => setRides(readStoredJson<SavedRide[]>(KEY, [])), []);

  const save = useCallback((name: string, route: string) => {
    setRides((current) => {
      // Saving the same ride twice renames it rather than listing it twice.
      const next: SavedRide[] = [
        {
          id: `${Date.now()}`,
          name: name.trim() || "Unnamed ride",
          route,
          savedAt: Date.now(),
        },
        ...current.filter((ride) => ride.route !== route),
      ];
      writeStoredJson(KEY, next);
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setRides((current) => {
      const next = current.filter((ride) => ride.id !== id);
      writeStoredJson(KEY, next);
      return next;
    });
  }, []);

  return { rides, save, remove };
}
