import { describe, expect, it } from "vitest";
import { graph, segment } from "@/lib/graph/test-fixtures";
import { serializeGraph, sortGraph, validateGraph } from "./graph-file";

describe("sortGraph", () => {
  it("orders every collection by id", () => {
    const sorted = sortGraph(
      graph({
        nodes: [
          { id: "n2", name: null, coord: [-122.3, 47.6] },
          { id: "n1", name: null, coord: [-122.3, 47.6] },
        ],
        segments: [segment("s2", "n1", "n2"), segment("s1", "n1", "n2")],
      }),
    );
    expect(sorted.nodes.map((n) => n.id)).toEqual(["n1", "n2"]);
    expect(sorted.segments.map((s) => s.id)).toEqual(["s1", "s2"]);
  });

  it("serializes identically no matter what order things arrive in", () => {
    // The admin autosaves and git is the review step, so a file that reshuffles
    // itself on every save produces a diff nobody can read.
    const a = graph({
      segments: [segment("s1", "nA", "nB"), segment("s2", "nB", "nC")],
    });
    const b = graph({
      segments: [segment("s2", "nB", "nC"), segment("s1", "nA", "nB")],
    });
    expect(serializeGraph(a)).toBe(serializeGraph(b));
  });

  it("ends with a newline so the file is well-formed for git", () => {
    expect(serializeGraph(graph()).endsWith("}\n")).toBe(true);
  });
});

describe("validateGraph", () => {
  it("passes a clean graph", () => {
    const clean = graph({
      nodes: [
        { id: "nA", name: null, coord: [-122.35, 47.65] },
        { id: "nB", name: null, coord: [-122.34, 47.65] },
      ],
      segments: [segment("s1", "nA", "nB", { reviewed: true })],
    });
    expect(validateGraph(clean)).toEqual([]);
  });

  it("flags a segment pointing at a node that does not exist", () => {
    const problems = validateGraph(
      graph({ segments: [segment("s1", "nA", "nGone", { reviewed: true })] }),
    );
    expect(
      problems.some((p) => p.level === "error" && /nGone/.test(p.message)),
    ).toBe(true);
  });

  it("flags duplicate segments between the same pair, in either direction", () => {
    const problems = validateGraph(
      graph({
        nodes: [
          { id: "nA", name: null, coord: [-122.35, 47.65] },
          { id: "nB", name: null, coord: [-122.34, 47.65] },
        ],
        segments: [
          segment("s1", "nA", "nB", { reviewed: true }),
          segment("s2", "nB", "nA", { reviewed: true }),
        ],
      }),
    );
    expect(problems.some((p) => /share the node pair/.test(p.message))).toBe(
      true,
    );
  });

  it("flags an orphan node", () => {
    const problems = validateGraph(
      graph({ nodes: [{ id: "nLost", name: null, coord: [-122.35, 47.65] }] }),
    );
    expect(
      problems.some((p) => /not used by any segment/.test(p.message)),
    ).toBe(true);
  });

  it("flags a pin positioned off the end of its segment", () => {
    const problems = validateGraph(
      graph({
        nodes: [
          { id: "nA", name: null, coord: [-122.35, 47.65] },
          { id: "nB", name: null, coord: [-122.34, 47.65] },
        ],
        segments: [segment("s1", "nA", "nB", { reviewed: true })],
        pins: [
          {
            id: "p1",
            segment: "s1",
            kind: "water",
            note: null,
            at: 1.4,
            coord: [-122.34, 47.65],
          },
        ],
      }),
    );
    expect(
      problems.some(
        (p) => p.level === "error" && /out-of-range/.test(p.message),
      ),
    ).toBe(true);
  });

  it("counts segments still carrying default attributes", () => {
    const problems = validateGraph(
      graph({
        nodes: [
          { id: "nA", name: null, coord: [-122.35, 47.65] },
          { id: "nB", name: null, coord: [-122.34, 47.65] },
        ],
        segments: [segment("s1", "nA", "nB")],
      }),
    );
    expect(problems.some((p) => /default attributes/.test(p.message))).toBe(
      true,
    );
  });

  it("reports problems instead of throwing, so the admin can keep working", () => {
    expect(() =>
      validateGraph(graph({ segments: [segment("s1", "a", "b")] })),
    ).not.toThrow();
  });
});

describe("serializeGraph formatting", () => {
  it("keeps a coordinate on one line", () => {
    // Otherwise a few hundred junctions become thousands of lines of single
    // numbers, and the file stops being reviewable in a diff.
    const serialized = serializeGraph(
      graph({
        nodes: [{ id: "n1", name: null, coord: [-122.35123, 47.65123] }],
      }),
    );
    expect(serialized).toContain('"coord": [-122.35123, 47.65123]');
  });

  it("still indents the structure around it", () => {
    const serialized = serializeGraph(
      graph({
        nodes: [{ id: "n1", name: "Gas Works", coord: [-122.3, 47.6] }],
      }),
    );
    expect(serialized).toContain('    "id": "n1"');
    expect(serialized).toContain('    "name": "Gas Works"');
  });

  it("round-trips back to the same graph", () => {
    const original = graph({
      nodes: [{ id: "n1", name: null, coord: [-122.35, 47.65] }],
      segments: [segment("s1", "n1", "n1")],
    });
    expect(JSON.parse(serializeGraph(original))).toEqual(sortGraph(original));
  });
});
