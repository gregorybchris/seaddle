import { describe, expect, it } from "vitest";
import { chosenName, routeNamed, type SavedRoute } from "./use-saved-routes";

function saved(id: string, name: string, route = "1-2"): SavedRoute {
  return { id, name, route, savedAt: 0 };
}

describe("chosenName", () => {
  it("takes what was typed, without the spaces around it", () => {
    expect(chosenName("  Thursday commute ")).toBe("Thursday commute");
  });

  it("names a route nobody named", () => {
    expect(chosenName("   ")).toBe("Unnamed route");
  });
});

describe("routeNamed", () => {
  const routes = [saved("a", "Thursday commute"), saved("b", "Alki and back")];

  it("finds the route already using a name", () => {
    expect(routeNamed(routes, "Alki and back")?.id).toBe("b");
  });

  // Two rows a rider cannot tell apart are two rows they cannot choose
  // between, whatever the strings do.
  it("reads the name the way the list is read", () => {
    expect(routeNamed(routes, " thursday COMMUTE ")?.id).toBe("a");
  });

  it("finds nothing for a name nobody has", () => {
    expect(routeNamed(routes, "Burke-Gilman")).toBeUndefined();
  });

  it("does not collide a route with itself", () => {
    expect(routeNamed(routes, "Thursday commute", "a")).toBeUndefined();
  });

  it("has nothing to say about an empty name", () => {
    expect(routeNamed([...routes, saved("c", "")], "  ")).toBeUndefined();
  });
});
