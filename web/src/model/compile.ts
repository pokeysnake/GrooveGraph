/** compiler --> Doc --> strudel code */
import type { Doc, GraphNode } from "./types";
import { nodesReachingOutput } from "./graph";
import { parseNotes } from "./notes";
import { getSound } from "./sounds";
import { OUTPUT_ID } from "./doc";
import { FILTERS, Q, type FilterKind } from "./filters";

// one cycle = one bar of this many beats, so the BPM box sets cycles per minute as bpm / BEATS_PER_BAR
export const BEATS_PER_BAR = 4;

export type CompileIssue = { nodeId: string; message: string };
/** where a Notes node's text landed in the code: code[start, end) is exactly that text (inside its quotes).
 *  A Notes node feeding two instruments lands twice. Used to light up the box that's playing. */
export type NotesSpan = { nodeId: string; start: number; end: number };
export type CompileResult = { code: string; issues: CompileIssue[]; notesSpans: NotesSpan[] };

type InstrumentNode = Extract<GraphNode, {type:"instrument"}>;
type FilterNode = Extract<GraphNode, { type: "filter" }>
type FxNode = Extract<GraphNode, { type: "fx" }>;
type ArrangeNode = Extract<GraphNode, { type: "arrange" }>;

// bars a section plays when its Arrange has no count for it yet (1 cycle = 1 bar)
export const DEFAULT_BARS = 4;

// Q for an FX row that doesn't carry one (same default the Filter node starts with)
const DEFAULT_Q = Q.def;

//top to bottom by canvas y; ties broken id so the output never depends on insertion order
export function byPosition(a:GraphNode, b:GraphNode): number {
    if(a.position.y !== b.position.y) return a.position.y - b.position.y;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function compile(doc:Doc): CompileResult {
    const nodes = Object.values(doc.nodes);
    const edges = Object.values(doc.edges);
    const issues = new Map<string, string>(); //nodeId --> message a map so each node is reported once

    /** SETUP */
    //only nodes with a path to the output can be heard
    const live = nodesReachingOutput(nodes,edges);

    //each live node's inputs, sorted top to bottom and how many live nodes read each node
    const inputs = new Map<string, GraphNode[]>();
    const uses = new Map<string, number>();

    for(const e of edges) {
        const src = doc.nodes[e.source];
        if(!src || !live.has(e.target)) continue;
        const list = inputs.get(e.target) ?? [];
        list.push(src);
        inputs.set(e.target, list);
        uses.set(e.source, (uses.get(e.source) ?? 0) + 1);
    }

    for (const list of inputs.values()) list.sort(byPosition);
    const inputsOf = (id:string) => inputs.get(id) ?? [];

    //mute always wins --> once any live instrument is soloed only soloed ones play
    const anySolo = nodes.some((n) => n.type === "instrument" && n.data.solo && live.has(n.id));
    const plays = (n: InstrumentNode) => !n.data.muted && (!anySolo || n.data.solo);

    /** INSTRUMENTS */
    //a JS string literal: JSON.stringify adds the quotes and escapes anything that would brak out of them
    const str = (s:string) => JSON.stringify(s);
    //one part played as is, 2+ played per cycle
    const catOf = (parts: string[]) => (parts.length === 1 ? parts[0] : `cat(${parts.join(", ")})`);

    // a Notes text goes into the code as a placeholder first and its string literal replaces it at the very end,
    // once its final offset is known (the code is built inside-out, so offsets aren't known while building)
    const notesLits: { nodeId: string; lit: string }[] = [];
    const notesLit = (nodeId: string, text: string) => {
        notesLits.push({ nodeId, lit: str(text) });
        return `\u0000${notesLits.length - 1}\u0000`;
    };

    //an instrument notes texts top to bottom (as placeholders), bad ones are reported and skipped, blanks skipped too
    function notesTexts(id:string) :string[] {
        const texts: string[] = [];
        for(const n of inputsOf(id)) {
            if(n.type !== "notes") continue;
            const parsed = parseNotes(n.data.text);
            if(!parsed.ok) issues.set(n.id, parsed.message); // the UI adds the node name (canvas/issues.ts)
            else if (parsed.steps.length > 0) texts.push(notesLit(n.id, n.data.text));
        }
        return texts;
    }

    function instrumentExpr(node: InstrumentNode): string | null {
        if(!plays(node)) return null;
        const sound = getSound(node.data.sound);
        if(!sound) {
            issues.set(node.id, `unknown sound: ${node.data.sound}`);
            return null;
        }
        const texts = notesTexts(node.id);
        if(texts.length === 0) return null;

        const { s, bank, n} = sound.strudel;
        const extras = (bank ? `.bank(${str(bank)})` : "") + (n !== undefined ? `.n(${n})` : "");
        if (sound.kind === "pitched") return `${catOf(texts.map((t) => `note(${t})`))}.s(${str(s)})${extras}`;
        return `s(${str(s)})${extras}.struct(${catOf(texts)})`;
    }

    /** Filters and Output */
    // Strudel's name for each filter's Q (resonance); filters not listed have no Q
    const Q_PARAM: Partial<Record<FilterKind, string>> = { lpf: "lpq", hpf: "hpq", bpf: "bpq" };

    // one part as is, 2+ played at the same time
    const stackOf = (parts: string[]) => (parts.length === 1 ? parts[0] : `stack(${parts.join(", ")})`);

    // the code for every input that has something to play
    const inputExprs = (id: string) =>
        inputsOf(id).map(exprOf).filter((e): e is string => e !== null);

    function filterExpr(node: FilterNode): string | null {
        const { kind, value, q } = node.data;
        if (!Object.hasOwn(FILTERS, kind)) {
            issues.set(node.id, `unknown filter: ${kind}`);
            return null;
        }
        const parts = inputExprs(node.id);
        if (parts.length === 0) return null;
        const qParam = Q_PARAM[kind];
        return `${stackOf(parts)}.${kind}(${value})` + (qParam ? `.${qParam}(${q})` : "");
    }

    /**
     * FX rack: its inputs (stacked) with every effect that's on chained after, top row first, e.g.
     *   stack(a, b).lpf(1200).lpq(0.7).gain(0.8).room(0.4)
     * bypassed rows are skipped; with nothing on, the rack just passes its inputs through.
     * An unknown kind (from a newer client, say) is reported and that row skipped, the rest still plays.
     */
    function fxExpr(node: FxNode): string | null {
        const parts = inputExprs(node.id);
        if (parts.length === 0) return null;
        let expr = stackOf(parts);
        for (const e of node.data.effects) {
            if (!e.on) continue;
            if (!Object.hasOwn(FILTERS, e.kind)) {
                issues.set(node.id, `unknown effect: ${e.kind}`);
                continue;
            }
            const qParam = Q_PARAM[e.kind];
            expr += `.${e.kind}(${e.value})` + (qParam ? `.${qParam}(${e.q ?? DEFAULT_Q})` : "");
        }
        return expr;
    }

    /**
     * Arrange: each input is a section that plays for its bar count, in order top to bottom, then loops, e.g.
     *   arrange([4, verse], [8, chorus])
     * inputs with nothing to play are skipped; a missing or bad count falls back to DEFAULT_BARS.
     */
    function arrangeExpr(node: ArrangeNode): string | null {
        const sections: string[] = [];
        for (const src of inputsOf(node.id)) {
            const expr = exprOf(src);
            if (expr === null) continue;
            const b = node.data.bars?.[src.id];
            const bars = Number.isInteger(b) && b >= 1 ? b : DEFAULT_BARS;
            sections.push(`[${bars}, ${expr}]`);
        }
        return sections.length > 0 ? `arrange(${sections.join(", ")})` : null;
    }

    // build a node's code from scratch (null = nothing to play); Notes are read by their instrument
    function buildExpr(node: GraphNode): string | null {
        switch (node.type) {
            case "instrument": return instrumentExpr(node);
            case "filter":     return filterExpr(node);
            case "fx":         return fxExpr(node);
            case "arrange":    return arrangeExpr(node);
            default:           return null;
        }
    }

    /** shared nodes become variables */
    const vars: string[] = [];                      // "const v1 = ..." lines, in the order they're needed
    const done = new Map<string, string | null>();  // node id -> its code or variable name, so each node is built once

    function exprOf(node: GraphNode): string | null {
        if (done.has(node.id)) return done.get(node.id) ?? null;
        let expr = buildExpr(node);
        if (expr !== null && (uses.get(node.id) ?? 0) >= 2) {
            const name = `v${vars.length + 1}`;
            vars.push(`const ${name} = ${expr}`);
            expr = name;
        }
        done.set(node.id, expr);
        return expr;
    }

    // cabled inputs first, then every live Arrange top to bottom (they join the Output wirelessly)
    const arranges = nodes.filter((n) => n.type === "arrange" && live.has(n.id)).sort(byPosition);
    const parts = [...inputExprs(OUTPUT_ID), ...arranges.map(exprOf).filter((e): e is string => e !== null)];
    const body = parts.length > 0 ? stackOf(parts) : "silence";
    const withHoles = [`setcpm(${doc.settings.bpm}/${BEATS_PER_BAR})`, ...vars, body].join("\n");

    // swap each placeholder for its string literal, noting where the text inside the quotes ends up
    const notesSpans: NotesSpan[] = [];
    let grown = 0; // how much longer the code has got so far
    const code = withHoles.replace(/\u0000(\d+)\u0000/g, (hole: string, i: string, at: number) => {
        const { nodeId, lit } = notesLits[Number(i)];
        const start = at + grown + 1; // +1 skips the opening quote
        notesSpans.push({ nodeId, start, end: start + lit.length - 2 });
        grown += lit.length - hole.length;
        return lit;
    });
    return { code, issues: [...issues].map(([nodeId, message]) => ({ nodeId, message })), notesSpans };

}

