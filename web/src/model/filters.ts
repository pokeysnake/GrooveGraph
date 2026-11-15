/* ---------- Filter types (shared by the model, the UI and the compiler) ---------- */
export const FILTERS = {
  lpf:   { label: "Low-pass",  unit: "Hz", min: 20, max: 20000, step: 10,   def: 800,  hasQ: true },
  hpf:   { label: "High-pass", unit: "Hz", min: 20, max: 20000, step: 10,   def: 200,  hasQ: true },
  bpf:   { label: "Band-pass", unit: "Hz", min: 20, max: 20000, step: 10,   def: 1000, hasQ: true },
  room:  { label: "Reverb",    unit: "",   min: 0,  max: 1,     step: 0.05, def: 0.3,  hasQ: false },
  delay: { label: "Delay",     unit: "",   min: 0,  max: 1,     step: 0.05, def: 0.25, hasQ: false },
  gain:  { label: "Gain",      unit: "",   min: 0,  max: 2,     step: 0.05, def: 1,    hasQ: false },
  // crush: bit depth, fewer bits = grittier (16 is clean). coarse: keeps every nth sample, higher = crunchier
  crush:   { label: "Bitcrush",   unit: "", min: 1,   max: 16,   step: 1,    def: 6,   hasQ: false },
  coarse:  { label: "Downsample", unit: "", min: 1,   max: 32,   step: 1,    def: 4,   hasQ: false },
  distort: { label: "Distortion", unit: "", min: 0,   max: 3,    step: 0.05, def: 0.5, hasQ: false },
  // shape must stay below 1 or Strudel's waveshaper blows up
  shape:   { label: "Saturation", unit: "", min: 0,   max: 0.95, step: 0.05, def: 0.4, hasQ: false },
  // phaser: sweep speed in cycles per second (not "Hz" here so it gets a plain slider, not the log one)
  phaser:  { label: "Phaser",     unit: "", min: 0.1, max: 8,    step: 0.1,  def: 2,   hasQ: false },
  // pan: 0 = hard left, 0.5 = center, 1 = hard right
  pan:     { label: "Pan",        unit: "", min: 0,   max: 1,    step: 0.05, def: 0.5, hasQ: false },
} as const;

export type FilterKind = keyof typeof FILTERS;

/** Q (resonance) for the kinds with hasQ: the range the UI offers and the value a new filter starts with */
export const Q = { min: 0.1, max: 20, def: 0.7 } as const;

/**
 * Plain-words help for the sidebar's "i" popup. A Record over FilterKind, so adding an effect to FILTERS
 * without writing its help here is a type error.
 */
export const FILTER_INFO: Record<FilterKind, { about: string; higher: string; lower: string }> = {
  lpf: {
    about: "Lets the lows through and cuts the highs. Makes a sound darker and softer.",
    higher: "brighter, more of the original sound gets through",
    lower: "darker and muffled, like hearing it through a wall",
  },
  hpf: {
    about: "Lets the highs through and cuts the lows. Thins a sound out.",
    higher: "thinner and tinnier, the bass disappears",
    lower: "fuller, more of the low end is kept",
  },
  bpf: {
    about: "Keeps only a band of frequencies around the value and cuts both sides.",
    higher: "the band moves up: nasal, telephone-like",
    lower: "the band moves down: boomy and hollow",
  },
  room: {
    about: "Reverb: puts the sound in a space, so it rings out like in a room or hall.",
    higher: "bigger, washier space and a longer tail",
    lower: "drier and closer, 0 is no reverb",
  },
  delay: {
    about: "Echo: repeats the sound after it plays.",
    higher: "louder echoes",
    lower: "quieter echoes, 0 is no echo",
  },
  gain: {
    about: "Volume.",
    higher: "louder (above 1 can clip and crackle)",
    lower: "quieter, 0 is silent",
  },
  crush: {
    about: "Bitcrush: lowers the bit depth for a gritty, 8-bit video game sound.",
    higher: "cleaner, 16 is almost untouched",
    lower: "grittier and noisier, 1-4 is very broken",
  },
  coarse: {
    about: "Downsample: drops samples for a crunchy, metallic, retro sound.",
    higher: "crunchier and more robotic",
    lower: "cleaner, 1 is untouched",
  },
  distort: {
    about: "Distortion: overdrives the sound so it gets dirty and aggressive.",
    higher: "harsher and fuzzier (and louder, so lower Gain after it)",
    lower: "subtler grit, 0 is clean",
  },
  shape: {
    about: "Saturation: a gentler drive that adds warmth and thickness.",
    higher: "warmer and more driven",
    lower: "subtler, 0 is clean",
  },
  phaser: {
    about: "Phaser: a swirling, whooshing sweep moving through the sound.",
    higher: "faster swirl",
    lower: "slower, smoother sweep",
  },
  pan: {
    about: "Pan: where the sound sits between the left and right speakers.",
    higher: "further right, 1 is fully right",
    lower: "further left, 0 is fully left (0.5 is the center)",
  },
};

/** help for the extra Q knob on Low-pass / High-pass / Band-pass */
export const Q_INFO = {
  about: "Q (resonance): how sharp the filter's edge is.",
  higher: "a ringing, whistly peak at the cutoff (the classic acid squelch)",
  lower: "a smooth, gentle cut",
};
