import { describe, expect, it } from "vitest";
import { routeLink } from "./share-route";

const HERE = { origin: "https://seaddle.com", pathname: "/" };

describe("routeLink", () => {
  it("carries the route", () => {
    expect(routeLink("17-42-43", HERE)).toBe("https://seaddle.com/?r=17-42-43");
  });

  it("leaves off the question mark when there is no route", () => {
    expect(routeLink("", HERE)).toBe("https://seaddle.com/");
  });

  it("says nothing about what the address bar happened to be showing", () => {
    expect(routeLink("17", { ...HERE, pathname: "/map" })).toBe(
      "https://seaddle.com/map?r=17",
    );
  });
});
