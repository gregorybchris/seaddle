import { describe, expect, it } from "vitest";
import {
  isPinKind,
  PIN_KINDS,
  PIN_LABELS,
  PIN_WARNINGS,
  type PinKind,
} from "./graph";

describe("pin kinds", () => {
  // `PIN_LABELS` is a `Record<PinKind, string>`, so the compiler already
  // insists it is complete. `PIN_KINDS` is only a `PinKind[]` — leaving a kind
  // out of it compiles perfectly and just quietly stops the admin offering it.
  // That is the gap this covers.
  it("offers every kind the labels know about", () => {
    expect([...PIN_KINDS].sort()).toEqual(Object.keys(PIN_LABELS).sort());
  });

  it("lists each kind once", () => {
    expect(new Set(PIN_KINDS).size).toBe(PIN_KINDS.length);
  });

  it("warns about kinds that exist", () => {
    for (const kind of PIN_WARNINGS) {
      expect(PIN_KINDS).toContain(kind);
    }
  });

  it("treats a hazard as a warning and an amenity as not", () => {
    expect(PIN_WARNINGS.has("hazard")).toBe(true);
    expect(PIN_WARNINGS.has("drinkingWater")).toBe(false);
  });
});

describe("isPinKind", () => {
  it("accepts every kind", () => {
    for (const kind of PIN_KINDS) expect(isPinKind(kind)).toBe(true);
  });

  it("rejects anything a pin file might arrive with instead", () => {
    // The case that matters is a kind from a newer build than this one.
    const notKinds: unknown[] = [
      "sinkhole",
      "",
      null,
      undefined,
      0,
      ["hazard"],
      { kind: "hazard" },
    ];
    for (const value of notKinds) expect(isPinKind(value)).toBe(false);
  });

  it("narrows the value for the caller", () => {
    const value: unknown = "hazard";
    if (!isPinKind(value)) throw new Error("expected a kind");
    const kind: PinKind = value;
    expect(PIN_LABELS[kind]).toBe("hazard");
  });
});
