import { beforeEach, describe, expect, it, vi } from "vitest";

/* a fake @strudel/web where the test decides when initStrudel finishes, so the timing bugs can be reproduced */
let finishInit: () => void = () => {};
const fake = {
  initStrudel: vi.fn(() => new Promise<void>((resolve) => { finishInit = resolve; })),
  evaluate: vi.fn<(code: string) => Promise<void>>(async () => {}),
  hush: vi.fn(),
  samples: vi.fn(async () => {}),
  getSuperdoughAudioController: () => ({ output: { destinationGain: null } }),
};
vi.mock("@strudel/web", () => fake);

// strudel.ts keeps module state (ready, generation), so each test gets a fresh copy
async function freshAudio() {
  vi.resetModules();
  return import("./strudel");
}

beforeEach(() => vi.clearAllMocks());

describe("audio/strudel", () => {
  it("Stop pressed while the first Play is still loading wins: nothing is evaluated", async () => {
    const audio = await freshAudio();
    const playing = audio.play("note(\"c4\")");
    await vi.waitFor(() => expect(fake.initStrudel).toHaveBeenCalled());
    await audio.stop();
    finishInit();
    await playing;
    expect(fake.evaluate).not.toHaveBeenCalled();
  });

  it("a Play after that Stop still plays", async () => {
    const audio = await freshAudio();
    const first = audio.play("a");
    await vi.waitFor(() => expect(fake.initStrudel).toHaveBeenCalled());
    await audio.stop();
    finishInit();
    await first;
    await audio.play("b");
    expect(evaluated()).toEqual(["b"]);
  });

  it("new code during the load is still evaluated (only Stop cancels)", async () => {
    const audio = await freshAudio();
    const first = audio.play("a");
    await vi.waitFor(() => expect(fake.initStrudel).toHaveBeenCalled());
    const second = audio.play("b");
    finishInit();
    await Promise.all([first, second]);
    expect(evaluated()).toEqual(["a", "b"]);
  });

  it("Stop before Strudel was ever started does nothing instead of throwing", async () => {
    const audio = await freshAudio();
    await expect(audio.stop()).resolves.toBeUndefined();
    expect(fake.hush).not.toHaveBeenCalled();
  });
});

// the code each evaluate got, without the note-highlight hook play() adds as its last line
function evaluated() {
  return fake.evaluate.mock.calls.map((c) => c[0].replace(/\n\.onTrigger\(.*\)$/, ""));
}

describe("audio/strudel: note highlight hook", () => {
  it("adds the onTrigger hook as the last line, so the offsets compile measured still hold", async () => {
    const audio = await freshAudio();
    const playing = audio.play('note("c4")');
    await vi.waitFor(() => expect(fake.initStrudel).toHaveBeenCalled());
    finishInit();
    await playing;
    const sent = fake.evaluate.mock.calls[0][0];
    expect(sent.startsWith('note("c4")\n.onTrigger(')).toBe(true);
    expect(sent.endsWith(", false)")).toBe(true); // false: the note still plays normally too
  });
});
