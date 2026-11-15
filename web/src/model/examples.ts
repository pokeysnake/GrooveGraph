import jamStart from "@shared/fixtures/demos/jam-start.json";
import groove from "@shared/fixtures/demos/groove.json";
import songForm from "@shared/fixtures/demos/song-form.json";
import retroKeys from "@shared/fixtures/demos/retro-keys.json";
import type { Op } from "./types";

/** a ready-made patch from shared/fixtures/demos (save-file format), offered in the sidebar's Examples menu */
export type Example = { id: string; name: string; hint: string; ops: Op[] };

// JSON imports are typed loosely (type: string, not "addNode"), so the cast; demos.test.ts checks every one loads
const opsOf = (file: { ops: unknown[] }) => file.ops as unknown as Op[];

/** simplest first, so the menu reads as a ladder: two drums, a full loop, a song with sections, then retro-keys */
export const EXAMPLES: Example[] = [
  { id: "jam-start", name: "Jam start", hint: "kick + hats", ops: opsOf(jamStart) },
  { id: "groove", name: "Groove", hint: "drums, bass, lead, filters", ops: opsOf(groove) },
  { id: "song-form", name: "Song form", hint: "verse, chorus, arrange", ops: opsOf(songForm) },
  { id: "retro-keys", name: "Retro keys", hint: "chords, lead, synth bass", ops: opsOf(retroKeys) },
];
