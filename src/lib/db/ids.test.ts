import { describe, expect, it } from "vitest";
import { nextId } from "./ids";

describe("nextId", () => {
  it("starts at one", () => {
    expect(nextId("n", [])).toBe("n001");
  });

  it("takes the next number after the highest", () => {
    expect(nextId("s", ["s001", "s004", "s002"])).toBe("s005");
  });

  it("does not reuse the number of something deleted", () => {
    // A stale geometry file should fail loudly rather than quietly attach
    // itself to whichever segment inherited its id.
    expect(nextId("s", ["s001", "s003"])).toBe("s004");
  });

  it("ignores ids belonging to other prefixes", () => {
    expect(nextId("n", ["s009", "p012", "n002"])).toBe("n003");
  });

  it("keeps counting past three digits", () => {
    expect(nextId("s", ["s999"])).toBe("s1000");
  });
});
