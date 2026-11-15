import { describe, it, expect } from "vitest";
import { compile } from "./compile";
import { emptyDoc, OUTPUT_ID } from "./doc";
import { edgeId } from "./types";
import type { Doc, FxEffect, GraphNode, InstrumentData } from "./types";
import type { FilterKind } from "./filters";

/** Builders: one line per node */
const at = (y: number) => ({ x: 0, y });

const notes = (id: string, text: string, y = 0): GraphNode => ({
  id,
  type: "notes",
  position: at(y),
  data: { name: id, text },
})

const inst = (
  id: string,
  sound: string,
  extra: Partial<InstrumentData> = {},
): GraphNode => ({
  id,
  type: "instrument",
  position: at(0),
  data: { sound, muted: false, solo: false, ...extra },
});

const filter = (
  id: string,
  kind: FilterKind,
  value: number,
  q = 0.7,
): GraphNode => ({
  id,
  type: "filter",
  position: at(0),
  data: { kind, value, q },
});

const OUT = OUTPUT_ID;


// a doc from nodes + [source, target] pairs --> skips applyOp on purpose to test compiler alone
function docOf(nodes:GraphNode[], links: [string, string][]): Doc {
    const doc = emptyDoc();
    for (const n of nodes) doc.nodes[n.id] = n;
    for(const [s,t] of links) doc.edges[edgeId(s,t)] = {id: edgeId(s,t), source: s, target: t};
    return doc;
}

// expected code: the BPM line plus the given lines
const code = (...lines: string[]) => ["setcpm(120/4)", ...lines].join("\n");

/**
 *  what each part does
 * - at(y) makes a position only y matters to the compiler for ordering, so x is always 0
 * - notes, inst, and filter build one node each in a single line, like the builders in applyOp.test.ts --> y = 0 and q = 0.7
 *   are defaults so tests can skip them
 * - extra: Partial<InstrumentData> lets a test write inst("i1", "saw", { muted: true }) and override only that field
 *      ...extra comes last to replace the default
 * - docOf starts from emptyDoc() so we get the real output node and default bpm of 120, then writes nodes and edges straight in
 * - edgeId(s,t) gives the same s -> t id that the real app uses alr
 */


/** 3 notes --> 3 inst --> 1 filter --> 1 output */
describe("compile", () => {
  it("compiles the mockup graph", () => {
    const doc = docOf(
      [
        notes("n1", "c4 e4 g4"), notes("n2", "c2 ~ c2 ~"), notes("n3", "x ~ x x"),
        inst("i1", "saw"), inst("i2", "square"), inst("i3", "tr909-bd"),
        filter("f1", "lpf", 800),
      ],
      [["n1", "i1"], ["n2", "i2"], ["n3", "i3"], ["i1", "f1"], ["i2", "f1"], ["i3", "f1"], ["f1", OUT]],
    );

    expect(compile(doc)).toMatchObject({
      code:
        'setcpm(120/4)\n' +
        'stack(note("c4 e4 g4").s("sawtooth"), note("c2 ~ c2 ~").s("square"), ' +
        's("bd").bank("RolandTR909").struct("x ~ x x")).lpf(800).lpq(0.7)',
      issues: [],
    });
  });

  // n2 is higher on screen (smaller y), so it plays first even though n1 was added first
  it("joins several Notes into one instrument with cat, top to bottom by y", () => {
    const doc = docOf(
      [notes("n1", "c4", 100), notes("n2", "e4", 50), inst("i1", "saw")],
      [["n1", "i1"], ["n2", "i1"], ["i1", OUT]],
    );
    expect(compile(doc).code).toBe(code('cat(note("e4"), note("c4")).s("sawtooth")'));
  });

  // percussion: the Notes are rhythms, so they go inside struct(...) as plain strings
  it("joins percussion rhythms with cat inside struct", () => {
    const doc = docOf(
      [notes("n1", "x ~", 0), notes("n2", "x x x x", 10), inst("i1", "tr909-hh")],
      [["n1", "i1"], ["n2", "i1"], ["i1", OUT]],
    );
    expect(compile(doc).code).toBe(code('s("hh").bank("RolandTR909").struct(cat("x ~", "x x x x"))'));
  });

  // n2 -> i2 never reaches the Output and f1 isn't connected at all
  it("leaves out nodes that don't reach the Output", () => {
    const doc = docOf(
      [notes("n1", "c4"), inst("i1", "saw"), notes("n2", "e4"), inst("i2", "square"), filter("f1", "room", 0.3)],
      [["n1", "i1"], ["i1", OUT], ["n2", "i2"]],
    );
    expect(compile(doc)).toMatchObject({ code: code('note("c4").s("sawtooth")'), issues: [] });
  });

  // a room with only the Output still has to be valid code
  it("compiles an empty doc to silence", () => {
    expect(compile(emptyDoc())).toMatchObject({ code: code("silence"), issues: [] });
  });

  it("uses the doc's bpm", () => {
    const doc = emptyDoc();
    doc.settings.bpm = 90;
    expect(compile(doc).code).toBe("setcpm(90/4)\nsilence");
  });

  // f1 feeds both f2 and the Output, so it's compiled once into v1 and used twice
  it("compiles a node feeding 2+ places once, as a variable", () => {
    const doc = docOf(
      [notes("n1", "c4"), inst("i1", "saw"), filter("f1", "lpf", 800), filter("f2", "room", 0.5)],
      [["n1", "i1"], ["i1", "f1"], ["f1", "f2"], ["f2", OUT], ["f1", OUT]],
    );
    expect(compile(doc).code).toBe(code(
      'const v1 = note("c4").s("sawtooth").lpf(800).lpq(0.7)',
      "stack(v1, v1.room(0.5))",
    ));
  });

  // a broken Notes node is skipped and reported; the rest of the song still plays
  it("skips bad notes and reports them", () => {
    const doc = docOf(
      [notes("n1", 'c4 "e4'), inst("i1", "saw"), notes("n2", "g4"), inst("i2", "square")],
      [["n1", "i1"], ["i1", OUT], ["n2", "i2"], ["i2", OUT]],
    );
    expect(compile(doc)).toMatchObject({
      code: code('note("g4").s("square")'),
      issues: [{ nodeId: "n1", message: expect.any(String) }],
    });
  });

  // i1 is muted, which leaves f1 with nothing to filter, so f1 is left out too
  it("leaves out muted instruments and filters with nothing left to play", () => {
    const doc = docOf(
      [notes("n1", "c4"), inst("i1", "saw", { muted: true }), filter("f1", "lpf", 800), notes("n2", "e4"), inst("i2", "square")],
      [["n1", "i1"], ["i1", "f1"], ["f1", OUT], ["n2", "i2"], ["i2", OUT]],
    );
    expect(compile(doc).code).toBe(code('note("e4").s("square")'));
  });

  // once anything is soloed, only soloed instruments play
  it("plays only soloed instruments when any are soloed", () => {
    const doc = docOf(
      [notes("n1", "c4"), inst("i1", "saw", { solo: true }), notes("n2", "e4"), inst("i2", "square")],
      [["n1", "i1"], ["i1", OUT], ["n2", "i2"], ["i2", OUT]],
    );
    expect(compile(doc).code).toBe(code('note("c4").s("sawtooth")'));
  });
});
/* ---------- FX rack ---------- */
const fxRack = (id: string, effects: FxEffect[]): GraphNode =>
  ({ id, type: "fx", position: at(0), data: { effects } });
const row = (id: string, kind: FilterKind, value: number, on = true, q?: number): FxEffect =>
  ({ id, kind, value, on, ...(q !== undefined ? { q } : {}) });

describe("compile: fx rack", () => {
  it("chains every effect that's on, top row first (filters get their Q)", () => {
    const doc = docOf(
      [notes("n", "c4"), inst("i", "saw"), fxRack("x", [
        row("e1", "lpf", 1200, true, 2), row("e2", "gain", 0.8), row("e3", "room", 0.4),
      ])],
      [["n", "i"], ["i", "x"], ["x", OUT]],
    );
    expect(compile(doc).code).toBe(code('note("c4").s("sawtooth").lpf(1200).lpq(2).gain(0.8).room(0.4)'));
  });

  it("skips bypassed rows, and a filter row without q uses 0.7", () => {
    const doc = docOf(
      [notes("n", "c4"), inst("i", "saw"), fxRack("x", [row("e1", "delay", 0.25, false), row("e2", "hpf", 300)])],
      [["n", "i"], ["i", "x"], ["x", OUT]],
    );
    expect(compile(doc).code).toBe(code('note("c4").s("sawtooth").hpf(300).hpq(0.7)'));
  });

  it("an empty or fully bypassed rack passes its input through", () => {
    const doc = docOf(
      [notes("n", "c4"), inst("i", "saw"), fxRack("x", [row("e1", "gain", 2, false)])],
      [["n", "i"], ["i", "x"], ["x", OUT]],
    );
    expect(compile(doc).code).toBe(code('note("c4").s("sawtooth")'));
  });

  it("stacks several inputs before the effects", () => {
    const doc = docOf(
      [notes("n1", "c4"), inst("i1", "saw"), notes("n2", "e4"), inst("i2", "square"), fxRack("x", [row("e1", "room", 0.5)])],
      [["n1", "i1"], ["n2", "i2"], ["i1", "x"], ["i2", "x"], ["x", OUT]],
    );
    expect(compile(doc).code).toBe(code('stack(note("c4").s("sawtooth"), note("e4").s("square")).room(0.5)'));
  });

  it("works next to a Filter node (instrument -> filter -> fx -> output)", () => {
    const doc = docOf(
      [notes("n", "c4"), inst("i", "saw"), filter("f", "lpf", 800), fxRack("x", [row("e1", "delay", 0.25)])],
      [["n", "i"], ["i", "f"], ["f", "x"], ["x", OUT]],
    );
    expect(compile(doc).code).toBe(code('note("c4").s("sawtooth").lpf(800).lpq(0.7).delay(0.25)'));
  });

  it("reports an unknown effect and still plays the rest", () => {
    const doc = docOf(
      [notes("n", "c4"), inst("i", "saw"),
        fxRack("x", [row("e1", "chorus" as FilterKind, 1), row("e2", "gain", 0.5)])],
      [["n", "i"], ["i", "x"], ["x", OUT]],
    );
    const r = compile(doc);
    expect(r.code).toBe(code('note("c4").s("sawtooth").gain(0.5)'));
    expect(r.issues).toEqual([{ nodeId: "x", message: "unknown effect: chorus" }]);
  });
});

const arr = (id: string, bars: Record<string, number> = {}, y = 0): GraphNode =>
  ({ id, type: "arrange", position: at(y), data: { bars } });
const at2 = (n: GraphNode, y: number): GraphNode => ({ ...n, position: at(y) });

describe("compile: arrange", () => {
  it("each input is a section with its bar count, top to bottom, and joins the Output without a cable", () => {
    const doc = docOf(
      [notes("n1", "c4"), notes("n2", "e4"), at2(inst("i1", "saw"), 0), at2(inst("i2", "square"), 10), arr("a", { i2: 8 })],
      [["n1", "i1"], ["n2", "i2"], ["i1", "a"], ["i2", "a"]],
    );
    expect(compile(doc).code).toBe(
      code('arrange([4, note("c4").s("sawtooth")], [8, note("e4").s("square")])'),
    );
  });

  it("stacks with what is cabled into the Output", () => {
    const doc = docOf(
      [notes("n1", "c4"), notes("n2", "e4"), inst("i1", "saw"), inst("i2", "square"), arr("a")],
      [["n1", "i1"], ["n2", "i2"], ["i1", OUT], ["i2", "a"]],
    );
    expect(compile(doc).code).toBe(
      code('stack(note("c4").s("sawtooth"), arrange([4, note("e4").s("square")]))'),
    );
  });

  it("an empty arrange is silent and skips inputs with nothing to play", () => {
    const doc = docOf([inst("i1", "saw"), arr("a")], [["i1", "a"]]);
    expect(compile(doc).code).toBe(code("silence"));
  });
});

describe("compile: where each Notes text lands (for lighting the playing box)", () => {
  // every span must cover exactly that node's text in the code
  const check = (doc: Doc) => {
    const { code, notesSpans } = compile(doc);
    for (const s of notesSpans) {
      const n = doc.nodes[s.nodeId];
      expect(n.type).toBe("notes");
      if (n.type === "notes") expect(code.slice(s.start, s.end)).toBe(n.data.text);
    }
    return notesSpans;
  };

  it("finds each text in the mockup graph", () => {
    const doc = docOf(
      [notes("n1", "c4 e4 g4"), notes("n2", "c2 ~ c2 ~"), notes("n3", "x ~ x x"), inst("i1", "saw"), inst("i2", "square"), inst("i3", "tr909-bd"), filter("f1", "lpf", 800)],
      [["n1", "i1"], ["n2", "i2"], ["n3", "i3"], ["i1", "f1"], ["i2", "f1"], ["i3", "f1"], ["f1", OUT]],
    );
    expect(check(doc).map((s) => s.nodeId).sort()).toEqual(["n1", "n2", "n3"]);
  });

  it("a Notes node feeding two instruments is found twice", () => {
    const doc = docOf(
      [notes("n1", "<[c4 e4] [g4,b4]>"), inst("i1", "saw"), inst("i2", "sine")],
      [["n1", "i1"], ["n1", "i2"], ["i1", OUT], ["i2", OUT]],
    );
    expect(check(doc).map((s) => s.nodeId)).toEqual(["n1", "n1"]);
  });

  it("works inside cat, shared variables and an Arrange", () => {
    const doc = docOf(
      [notes("a", "c4", 0), notes("b", "e4 g4", 10), inst("i1", "saw"), filter("f1", "lpf", 800), arr("ar")],
      [["a", "i1"], ["b", "i1"], ["i1", "f1"], ["i1", "ar"], ["f1", OUT]],
    );
    expect(compile(doc).code).toContain("const v1");
    expect(check(doc).map((s) => s.nodeId)).toEqual(["a", "b"]);
  });

  it("silent and invalid Notes have no span", () => {
    const doc = docOf([notes("n1", "c4 [e4"), notes("n2", "c4"), inst("i1", "saw")], [["n1", "i1"], ["n2", "i1"]]);
    expect(check(doc)).toEqual([]);
  });
});
