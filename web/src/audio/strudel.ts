// Thin wrapper around @strudel/web. Audio may only start after a user gesture,
// so initStrudel() is called lazily from the Play button.
import type { NotesSpan } from "@/model/compile";
import { clearPlaying, onNoteTriggered, setNotesSpans } from "./playing";

// the evaluated code calls this for every note (see play()); a global because Strudel runs the code as plain JS
const HOOK = "__musicCanvasNote";
(globalThis as Record<string, unknown>)[HOOK] = onNoteTriggered;
let ready: Promise<void> | null = null;

// volume settings
let volume = 0.5; //0..1 the slider position

// master gain right before speakers; squared because loudness feels logarithmic,
// so the slider's middle sounds like "half" instead of nearly full
function applyVolume (s: typeof import("@strudel/web")) {
  const g = s.getSuperdoughAudioController().output.destinationGain;
  if(g) g.gain.value = volume * volume;
}

export async function  setVolume(v: number): Promise<void> {
  volume = v;
  if(!ready) return; //not init yet --> play() applies it after init
  const s = await load();
  applyVolume(s);
}

// initStrudel only registers the built-in synths; sample-based sounds (piano, drum machines)
// need their sample maps registered too. These are the same maps strudel.cc loads.
const DOUGH = "https://raw.githubusercontent.com/felixroos/dough-samples/main";

async function load() {
  return import("@strudel/web");
}

// bumped by every stop(); a play() that was waiting on init when Stop was pressed sees a
// different number afterwards and gives up, so a slow first load can't start music after Stop
let generation = 0;

/** notesSpans: where each Notes text is in `code` (from compile), so the playing box can light up */
export async function play(code: string, notesSpans: NotesSpan[] = []): Promise<void> {
  const gen = generation;
  const s = await load();
  if (!ready) {
    ready = Promise.resolve(
      s.initStrudel({
        // runs after the synths are registered; only the JSON name lists download here,
        // each audio file is fetched the first time it plays
        prebake: () => Promise.all([
          s.samples(`${DOUGH}/piano.json`),
          s.samples(`${DOUGH}/tidal-drum-machines.json`),
        ]),
      }),
    )
      .then(() => undefined)
      .catch((e) => {
        ready = null; // let the next Play retry instead of caching the failure
        throw e;
      });
  }
  await ready;
  if (gen !== generation) return; // Stop was pressed while we waited
  applyVolume(s); // the slider may have moved before the first Play
  setNotesSpans(notesSpans);
  // hand every note to the highlighter too. Appended only here, so the Strudel tab shows clean code, and at the
  // end, so every offset compile() measured still holds. false = keep playing it normally as well.
  await s.evaluate(`${code}\n.onTrigger((...a) => globalThis.${HOOK}?.(...a), false)`);
}

export async function stop(): Promise<void> {
  generation++;
  clearPlaying();
  if (!ready) return; // never started: hush() would throw because Strudel has no repl yet
  const s = await load();
  s.hush();
}
