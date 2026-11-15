/* ---------- Approved sounds (shared by the model, the UI and the compiler) ---------- */
// Instruments store one of these ids, never a Strudel name, so what an id plays can change
// later without breaking saved rooms. Every entry was played in the Strudel REPL first.
// Stage 6: the server keeps a Python copy of this list.

export type SoundKind = "pitched" | "percussion";

export type SoundDef = {
  id: string;
  label: string;
  category: "synths" | "samples" | "soundfonts" | "drum-machines" | "dirt" | "wavetables";  // menu groups, after strudel.cc's sounds panel
  kind: SoundKind;                                    // pitched: note("..."), percussion: rhythm via struct("...")
  strudel: { s: string; bank?: string; n?: number };  // what the compiler writes: s(...).bank(...).n(...)
};

const TR909 = "RolandTR909";
const drum909 = (s: string, label: string): SoundDef =>
  ({ id: `tr909-${s}`, label: `909 ${label}`, category: "drum-machines", kind: "percussion", strudel: { s, bank: TR909 } });

const gm = (name: string, label: string): SoundDef =>
  ({ id: `gm-${name.replaceAll("_", "-")}`, label, category: "soundfonts", kind: "pitched", strudel: { s: `gm_${name}` } });
const dirt = (s: string, label: string): SoundDef =>
  ({ id: `dirt-${s}`, label: `Dirt ${label}`, category: "dirt", kind: "percussion", strudel: { s } });

export const SOUNDS: readonly SoundDef[] = [
  { id: "saw",      label: "Saw",      category: "synths", kind: "pitched", strudel: { s: "sawtooth" } },
  { id: "square",   label: "Square",   category: "synths", kind: "pitched", strudel: { s: "square" } },
  { id: "triangle", label: "Triangle", category: "synths", kind: "pitched", strudel: { s: "triangle" } },
  { id: "sine",     label: "Sine",     category: "synths", kind: "pitched", strudel: { s: "sine" } },
  { id: "piano",    label: "Piano",    category: "samples", kind: "pitched", strudel: { s: "piano" } },
  drum909("bd", "Kick"),
  drum909("sd", "Snare"),
  drum909("hh", "Closed Hat"),
  drum909("oh", "Open Hat"),
  drum909("cp", "Clap"),
  drum909("cr", "Crash"),
  // General MIDI soundfonts (@strudel/soundfonts): a hand-picked slice of the 128, grouped by feel
  gm("epiano1", "E-Piano"),
  gm("epiano2", "FM E-Piano"),
  gm("electric_grand_piano", "Electric Grand"),
  gm("harpsichord", "Harpsichord"),
  gm("clavinet", "Clavinet"),
  gm("drawbar_organ", "Drawbar Organ"),
  gm("percussive_organ", "Perc Organ"),
  gm("rock_organ", "Rock Organ"),
  gm("church_organ", "Church Organ"),
  gm("music_box", "Music Box"),
  gm("celesta", "Celesta"),
  gm("glockenspiel", "Glockenspiel"),
  gm("vibraphone", "Vibraphone"),
  gm("marimba", "Marimba"),
  gm("kalimba", "Kalimba"),
  gm("tubular_bells", "Tubular Bells"),
  gm("steel_drums", "Steel Drums"),
  gm("lead_1_square", "Square Lead"),
  gm("lead_2_sawtooth", "Saw Lead"),
  gm("lead_8_bass_lead", "Bass Lead"),
  gm("pad_warm", "Warm Pad"),
  gm("pad_poly", "Poly Pad"),
  gm("pad_halo", "Halo Pad"),
  gm("synth_strings_1", "Synth Strings"),
  gm("synth_brass_1", "Synth Brass"),
  gm("synth_bass_1", "Synth Bass"),
  gm("synth_bass_2", "Synth Bass 2"),
  gm("acoustic_bass", "Upright Bass"),
  gm("electric_bass_finger", "Electric Bass"),
  gm("pizzicato_strings", "Pizzicato"),
  gm("string_ensemble_1", "Strings"),
  gm("choir_aahs", "Choir"),
  gm("flute", "Flute"),
  // Tidal's classic Dirt-Samples pack, plain s("...") names with no bank
  dirt("bd", "Kick"),
  dirt("sn", "Snare"),
  dirt("hh", "Hat"),
  dirt("ho", "Open Hat"),
  dirt("cp", "Clap"),
  dirt("808bd", "808 Kick"),
  dirt("808sd", "808 Snare"),
  dirt("808hc", "808 Hat"),
  dirt("perc", "Perc"),
  dirt("tabla", "Tabla"),
  dirt("glitch", "Glitch"),
  dirt("jazz", "Jazz Kit"),
];

const BY_ID = new Map(SOUNDS.map((s) => [s.id, s]));

export const DEFAULT_SOUND = "triangle";

export const getSound = (id: string): SoundDef | undefined => BY_ID.get(id);
export const isSoundId = (id: string): boolean => BY_ID.has(id);
