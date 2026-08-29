import { describe, expect, it } from "vitest";
import { linkSearch, parseLink } from "./link";

describe("parseLink", () => {
  it("reads both halves", () => {
    expect(parseLink("?r=17-42&s=9")).toEqual({
      route: "17-42",
      selected: "s009",
    });
  });

  it("gives back nothing for an empty link", () => {
    expect(parseLink("")).toEqual({ route: "", selected: null });
  });

  it("treats an empty parameter as absent", () => {
    expect(parseLink("?s=")).toEqual({ route: "", selected: null });
  });

  it("still reads a segment spelled the way links used to spell it", () => {
    expect(parseLink("?s=s009").selected).toBe("s009");
  });

  it("keeps a segment it cannot make an id out of out of the link", () => {
    expect(parseLink("?s=north").selected).toBeNull();
  });
});

describe("linkSearch", () => {
  it("leaves the half it was not given alone", () => {
    expect(linkSearch("?r=1&s=9", { selected: "s012" })).toBe("r=1&s=12");
    expect(linkSearch("?r=1&s=9", { route: "1-2" })).toBe("r=1-2&s=9");
  });

  it("writes nothing a query string would have to escape", () => {
    expect(linkSearch("", { route: "17-42-43-88", selected: "s009" })).toBe(
      "r=17-42-43-88&s=9",
    );
  });

  it("drops a parameter that has been emptied", () => {
    expect(linkSearch("?r=1&s=9", { selected: null })).toBe("r=1");
    expect(linkSearch("?r=1&s=9", { route: "" })).toBe("s=9");
    expect(linkSearch("?r=1", { route: "", selected: null })).toBe("");
  });

  it("adds a half the link did not have", () => {
    expect(linkSearch("?r=1", { selected: "s009" })).toBe("r=1&s=9");
  });
});
