import { describe, it, expect } from "vitest";
import {
  barDuration,
  timestamps,
  selectedRange,
  newProject,
  migrate,
  editPlan,
  instructions,
  type Annotation,
} from "./model";
describe("musical grid", () => {
  it("uses quarter-note tempo including 6/8", () => {
    expect(barDuration(120, { numerator: 4, denominator: 4 })).toBe(2);
    expect(barDuration(120, { numerator: 3, denominator: 4 })).toBe(1.5);
    expect(barDuration(120, { numerator: 6, denominator: 8 })).toBe(1.5);
  });
  it("maps inclusive bar numbers to exact end-exclusive seconds", () => {
    const p = { ...newProject(), bpm: 132 };
    expect(timestamps(p, { barStart: 5, barEnd: 8 })).toEqual({
      startSeconds: (16 * 60) / 132,
      endSeconds: (32 * 60) / 132,
    });
  });
  it("clamps and reverses drag", () => {
    expect(selectedRange(8, 5, 100)).toEqual({ barStart: 5, barEnd: 8 });
    expect(selectedRange(-2, 12, 10)).toEqual({ barStart: 1, barEnd: 10 });
  });
  it("clamps final partial bar to audio end", () => {
    const p = {
      ...newProject(),
      bpm: 120,
      source: { name: "x.wav", size: 1, type: "audio/wav", duration: 5 },
    };
    expect(timestamps(p, { barStart: 3, barEnd: 3 }).endSeconds).toBe(5);
  });
});
describe("project handoff", () => {
  const ref: Annotation = {
    id: "ref1",
    type: "REFERENCE",
    barStart: 5,
    barEnd: 8,
    instruction: "Use this groove",
    referenceName: "GROOVE_A",
    referenceIds: [],
  };
  const note: Annotation = {
    id: "note",
    type: "VARIATION",
    barStart: 29,
    barEnd: 32,
    instruction: "Use GROOVE_A for first twelve bars",
    referenceName: "",
    referenceIds: ["ref1"],
  };
  const p = {
    ...newProject("Test"),
    annotations: [note, ref],
    globalRules: "Preserve voices\nKeep microtiming",
  };
  it("round trips all metadata", () =>
    expect(migrate(JSON.parse(JSON.stringify(p)))).toEqual(p));
  it("exports deterministically and resolves references", () => {
    const x = editPlan(p);
    expect(JSON.stringify(x)).toBe(JSON.stringify(editPlan(p)));
    expect(x.annotations[1].references).toEqual(["GROOVE_A"]);
    expect(x.references[0].barStart).toBe(5);
    expect(x.globalRules).toHaveLength(2);
    expect(instructions(p)).toContain("GROOVE_A");
  });
  it("rejects malformed or future data", () => {
    expect(() => migrate({ ...p, bpm: 0 })).toThrow();
    expect(() => migrate({ ...p, schemaVersion: 999 })).toThrow();
    expect(() =>
      migrate({ ...p, annotations: [{ ...ref, barEnd: 1 }] }),
    ).toThrow();
  });
  it("rejects duplicate reference names and dangling links", () => {
    expect(() =>
      migrate({ ...p, annotations: [ref, { ...ref, id: "ref2" }] }),
    ).toThrow();
    expect(() => migrate({ ...p, annotations: [note] })).toThrow();
  });
});
