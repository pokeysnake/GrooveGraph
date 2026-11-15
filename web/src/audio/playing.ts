/* ---------- Which Notes boxes are sounding right now (display only) ----------
   Strudel tags every note it plays with where it was written in the code (hap.context.locations, from its
   transpiler). compile() says where each Notes node's text sits in that code (notesSpans), so a note maps to
   (Notes node, offset in its text), and the node lights the box covering that offset.

   This is local and throwaway on purpose: dozens of updates a second, never React state at the top, never an
   op, never synced. Each person sees what their own speakers are playing. */
import type { NotesSpan } from "@/model/compile";

type Loc = { start: number; end: number };
/** the bits of a Strudel hap this reads (kept loose: it comes from untyped Strudel code) */
export type HapLike = { context?: { locations?: Loc[] }; duration: { valueOf(): number } };

let spans: NotesSpan[] = [];
let generation = 0; // bumped by clearPlaying(); timers from before it do nothing

// nodeId -> offset in its text -> how many notes there are sounding right now (a chord or overlap can share one)
const active = new Map<string, Map<number, number>>();
const snapshot = new Map<string, string>(); // nodeId -> its sounding offsets as "3,8", stable between changes
const listeners = new Map<string, Set<() => void>>();

function bump(nodeId: string, offset: number, by: 1 | -1) {
  const counts = active.get(nodeId) ?? new Map<number, number>();
  const n = (counts.get(offset) ?? 0) + by;
  if (n > 0) counts.set(offset, n);
  else counts.delete(offset);
  active.set(nodeId, counts);
  snapshot.set(nodeId, [...counts.keys()].sort((a, b) => a - b).join(","));
  listeners.get(nodeId)?.forEach((f) => f());
}

/** where each Notes text is in the code about to be evaluated (call right before evaluating it) */
export function setNotesSpans(next: NotesSpan[]) {
  spans = next;
}

/** which Notes node and offset a code location belongs to, or null (the sound name, a bank, an effect...) */
export function notesOffsetAt(loc: Loc, within: NotesSpan[] = spans): { nodeId: string; offset: number } | null {
  const s = within.find((sp) => loc.start >= sp.start && loc.end <= sp.end);
  return s ? { nodeId: s.nodeId, offset: loc.start - s.start } : null;
}

/** Strudel's onTrigger callback: (hap, now, cps, targetTime). Notes are handed over ~0.1-0.2 s before they
 *  sound, so wait until targetTime, light the box for the note's length, then let it go. */
export function onNoteTriggered(hap: HapLike, now: number, cps: number, at: number) {
  const gen = generation;
  const seconds = hap.duration.valueOf() / cps;
  const delayMs = Math.max(0, (at - now) * 1000);
  // a short gap before the next note, so repeated notes on one box still visibly blink
  const holdMs = Math.max(50, seconds * 1000 - 30);
  for (const loc of hap.context?.locations ?? []) {
    const hit = notesOffsetAt(loc);
    if (!hit) continue;
    setTimeout(() => {
      if (gen !== generation) return;
      bump(hit.nodeId, hit.offset, 1);
      setTimeout(() => gen === generation && bump(hit.nodeId, hit.offset, -1), holdMs);
    }, delayMs);
  }
}

/** Stop: nothing is sounding any more */
export function clearPlaying() {
  generation++;
  const ids = [...active.keys()];
  active.clear();
  snapshot.clear();
  ids.forEach((id) => listeners.get(id)?.forEach((f) => f()));
}

/* ---------- for useSyncExternalStore in the Notes node ---------- */
export function subscribePlaying(nodeId: string, f: () => void) {
  const set = listeners.get(nodeId) ?? new Set();
  set.add(f);
  listeners.set(nodeId, set);
  return () => {
    set.delete(f);
  };
}

export const playingSnapshot = (nodeId: string) => snapshot.get(nodeId) ?? "";
