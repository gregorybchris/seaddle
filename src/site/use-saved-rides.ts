import { useCallback, useEffect, useState } from "react";

const KEY = "seaddle.rides";

export type SavedRide = {
  id: string;
  name: string;
  /** The route as it appears in a link. */
  route: string;
  savedAt: number;
};

/**
 * Storage can be missing or refuse to answer — a private window, a browser set
 * to block site data — and a saved-rides list is a convenience, not a reason
 * for the page to fail. An unavailable store behaves as an empty one.
 */
function read(): SavedRide[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SavedRide[]) : [];
  } catch {
    return [];
  }
}

function write(rides: SavedRide[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(rides));
  } catch {
    // Nothing to do about it, and nothing worth interrupting the ride for.
  }
}

export function useSavedRides() {
  const [rides, setRides] = useState<SavedRide[]>([]);

  useEffect(() => setRides(read()), []);

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
      write(next);
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setRides((current) => {
      const next = current.filter((ride) => ride.id !== id);
      write(next);
      return next;
    });
  }, []);

  return { rides, save, remove };
}
