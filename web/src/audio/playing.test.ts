import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearPlaying, notesOffsetAt, onNoteTriggered, playingSnapshot, setNotesSpans, subscribePlaying } from "./playing";

// "a" sits at code[10, 20), "b" at code[30, 35)
const SPANS = [
  { nodeId: "a", start: 10, end: 20 },
  { nodeId: "b", start: 30, end: 35 },
];
const hap = (locs: { start: number; end: number }[], duration = 0.25) => ({
  context: { locations: locs },
  duration: { valueOf: () => duration },
});

describe("audio/playing: notesOffsetAt", () => {
  it("maps a location inside a Notes text to that node and the offset in its text", () => {
    expect(notesOffsetAt({ start: 13, end: 15 }, SPANS)).toEqual({ nodeId: "a", offset: 3 });
    expect(notesOffsetAt({ start: 30, end: 31 }, SPANS)).toEqual({ nodeId: "b", offset: 0 });
  });

  it("ignores locations outside every Notes text (a sound name, an effect) or crossing its edge", () => {
    expect(notesOffsetAt({ start: 0, end: 4 }, SPANS)).toBeNull();
    expect(notesOffsetAt({ start: 18, end: 22 }, SPANS)).toBeNull();
  });
});

describe("audio/playing: onNoteTriggered", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setNotesSpans(SPANS);
  });
  afterEach(() => {
    clearPlaying();
    vi.useRealTimers();
  });

  it("lights the box when the note sounds, not when Strudel hands it over, and lets go after its length", () => {
    // cps 1 and duration 0.25: sounds 0.2 s from now for 250 ms
    onNoteTriggered(hap([{ start: 12, end: 14 }]), 1.0, 1, 1.2);
    expect(playingSnapshot("a")).toBe("");
    vi.advanceTimersByTime(200);
    expect(playingSnapshot("a")).toBe("2");
    vi.advanceTimersByTime(250);
    expect(playingSnapshot("a")).toBe("");
  });

  it("a chord or overlap on one box keeps it lit until the last of them ends", () => {
    onNoteTriggered(hap([{ start: 12, end: 14 }], 0.5), 0, 1, 0);
    onNoteTriggered(hap([{ start: 12, end: 14 }], 0.25), 0, 1, 0);
    vi.advanceTimersByTime(0);
    expect(playingSnapshot("a")).toBe("2");
    vi.advanceTimersByTime(300);
    expect(playingSnapshot("a")).toBe("2");
    vi.advanceTimersByTime(300);
    expect(playingSnapshot("a")).toBe("");
  });

  it("tells only that node's listeners", () => {
    const onA = vi.fn();
    const onB = vi.fn();
    const offA = subscribePlaying("a", onA);
    const offB = subscribePlaying("b", onB);
    onNoteTriggered(hap([{ start: 12, end: 14 }]), 0, 1, 0);
    vi.advanceTimersByTime(0);
    expect(onA).toHaveBeenCalled();
    expect(onB).not.toHaveBeenCalled();
    offA();
    offB();
  });

  it("Stop clears everything, and notes scheduled before it never light", () => {
    onNoteTriggered(hap([{ start: 12, end: 14 }]), 0, 1, 0);
    onNoteTriggered(hap([{ start: 31, end: 32 }]), 0, 1, 0.5);
    vi.advanceTimersByTime(0);
    expect(playingSnapshot("a")).toBe("2");
    clearPlaying();
    expect(playingSnapshot("a")).toBe("");
    vi.advanceTimersByTime(1000);
    expect(playingSnapshot("b")).toBe("");
  });
});
