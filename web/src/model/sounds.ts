/* ---------- Approved sounds (shared by the model, the UI and the compiler) ---------- */
// Instruments store one of these ids, never a Strudel name, so what an id plays can change
// later without breaking saved rooms. Every entry was played in the Strudel REPL first.
// Stage 6: the server keeps a Python copy of this list.

export type SoundKind = "pitched" | "percussion";

export type SoundDef = {
  id: string;
  label: string;
  category: "synths" | "samples" | "soundfonts" | "vcsl" | "drum-machines" | "dirt" | "wavetables";  // menu groups, after strudel.cc's sounds panel
  kind: SoundKind;                                    // pitched: note("..."), percussion: rhythm via struct("...")
  strudel: { s: string; bank?: string; n?: number };  // what the compiler writes: s(...).bank(...).n(...)
};

const TR909 = "RolandTR909";
const drum909 = (s: string, label: string): SoundDef =>
  ({ id: `tr909-${s}`, label: `909 ${label}`, category: "drum-machines", kind: "percussion", strudel: { s, bank: TR909 } });

// one machine's kit from a bank: kit("tr808", "RolandTR808", "808", [["bd", "Kick"], ...]) -> ids tr808-bd...
const kit = (idPrefix: string, bank: string, labelPrefix: string, parts: [string, string][]): SoundDef[] =>
  parts.map(([s, label]) =>
    ({ id: `${idPrefix}-${s}`, label: `${labelPrefix} ${label}`, category: "drum-machines", kind: "percussion", strudel: { s, bank } }));
const CORE_KIT: [string, string][] =
  [["bd", "Kick"], ["sd", "Snare"], ["hh", "Closed Hat"], ["oh", "Open Hat"], ["cp", "Clap"], ["rim", "Rim"]];

// vcsl (Versilian Community Sample Library): real recorded instruments. Pitched ones have a sample per note
const vcsl = (s: string, label: string, kind: SoundKind = "pitched"): SoundDef =>
  ({ id: `vcsl-${s.replaceAll("_", "-")}`, label, category: "vcsl", kind, strudel: { s } });

const gm = (name: string, label: string): SoundDef =>
  ({ id: `gm-${name.replaceAll("_", "-")}`, label, category: "soundfonts", kind: "pitched", strudel: { s: `gm_${name}` } });
const dirt = (s: string, label: string): SoundDef =>
  ({ id: `dirt-${s}`, label: `Dirt ${label}`, category: "dirt", kind: "percussion", strudel: { s } });

export const SOUNDS: readonly SoundDef[] = [
  { id: "saw",      label: "Saw",      category: "synths", kind: "pitched", strudel: { s: "sawtooth" } },
  { id: "square",   label: "Square",   category: "synths", kind: "pitched", strudel: { s: "square" } },
  { id: "triangle", label: "Triangle", category: "synths", kind: "pitched", strudel: { s: "triangle" } },
  { id: "sine",     label: "Sine",     category: "synths", kind: "pitched", strudel: { s: "sine" } },
  { id: "supersaw", label: "Supersaw", category: "synths", kind: "pitched", strudel: { s: "supersaw" } },
  { id: "pulse", label: "Pulse", category: "synths", kind: "pitched", strudel: { s: "pulse" } },
  // ZzFX: tiny retro game-console synths
  { id: "zzfx-square", label: "Chip Square", category: "synths", kind: "pitched", strudel: { s: "z_square" } },
  { id: "zzfx-saw", label: "Chip Saw", category: "synths", kind: "pitched", strudel: { s: "z_sawtooth" } },
  { id: "zzfx-triangle", label: "Chip Triangle", category: "synths", kind: "pitched", strudel: { s: "z_triangle" } },
  { id: "zzfx-sine", label: "Chip Sine", category: "synths", kind: "pitched", strudel: { s: "z_sine" } },
  { id: "zzfx-tan", label: "Chip Tan", category: "synths", kind: "pitched", strudel: { s: "z_tan" } },
  // synth percussion: no samples, made by the engine
  { id: "sbd", label: "Synth Kick", category: "synths", kind: "percussion", strudel: { s: "sbd" } },
  { id: "white", label: "White Noise", category: "synths", kind: "percussion", strudel: { s: "white" } },
  { id: "pink", label: "Pink Noise", category: "synths", kind: "percussion", strudel: { s: "pink" } },
  { id: "brown", label: "Brown Noise", category: "synths", kind: "percussion", strudel: { s: "brown" } },
  { id: "crackle", label: "Crackle", category: "synths", kind: "percussion", strudel: { s: "crackle" } },
  { id: "zzfx-noise", label: "Chip Noise", category: "synths", kind: "percussion", strudel: { s: "z_noise" } },
  { id: "piano",    label: "Piano",    category: "samples", kind: "pitched", strudel: { s: "piano" } },
  drum909("bd", "Kick"),
  drum909("sd", "Snare"),
  drum909("hh", "Closed Hat"),
  drum909("oh", "Open Hat"),
  drum909("cp", "Clap"),
  drum909("cr", "Crash"),
  // more machines from tidal-drum-machines (already loaded for the 909)
  ...kit("tr808", "RolandTR808", "808", [...CORE_KIT, ["cb", "Cowbell"], ["lt", "Low Tom"], ["cr", "Crash"]]),
  ...kit("tr707", "RolandTR707", "707", [...CORE_KIT, ["cr", "Crash"]]),
  ...kit("linn", "LinnDrum", "Linn", [...CORE_KIT, ["sh", "Shaker"], ["tb", "Tambourine"]]),
  ...kit("mpc60", "AkaiMPC60", "MPC60", [...CORE_KIT, ["rd", "Ride"]]),
  ...kit("sp12", "EmuSP12", "SP-12", [...CORE_KIT, ["rd", "Ride"], ["cr", "Crash"]]),
  // vcsl: pitched instruments
  vcsl("steinway", "Steinway Grand"),
  vcsl("fmpiano", "FM Piano"),
  vcsl("organ_full", "Organ"),
  vcsl("pipeorgan_quiet", "Pipe Organ"),
  vcsl("marimba", "Marimba (real)"),
  vcsl("vibraphone", "Vibraphone (real)"),
  vcsl("glockenspiel", "Glockenspiel (real)"),
  vcsl("xylophone_medium_ff", "Xylophone"),
  vcsl("kalimba", "Kalimba (real)"),
  vcsl("tubularbells", "Tubular Bells (real)"),
  vcsl("harp", "Harp"),
  vcsl("psaltery_pluck", "Psaltery Pluck"),
  vcsl("ocarina", "Ocarina"),
  vcsl("recorder_alto_sus", "Recorder"),
  vcsl("super64", "Harmonica"),
  // vcsl: percussion
  vcsl("conga", "Conga", "percussion"),
  vcsl("bongo", "Bongo", "percussion"),
  vcsl("cajon", "Cajon", "percussion"),
  vcsl("darbuka", "Darbuka", "percussion"),
  vcsl("tambourine", "Tambourine", "percussion"),
  vcsl("shaker_small", "Shaker", "percussion"),
  vcsl("cowbell", "Cowbell", "percussion"),
  vcsl("woodblock", "Woodblock", "percussion"),
  vcsl("clave", "Clave", "percussion"),
  vcsl("triangles", "Triangle (bell)", "percussion"),
  vcsl("handbells", "Handbells", "percussion"),
  vcsl("sleighbells", "Sleigh Bells", "percussion"),
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
