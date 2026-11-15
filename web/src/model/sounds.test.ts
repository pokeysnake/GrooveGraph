import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { DEFAULT_SOUND, SOUNDS, getSound, isSoundId } from "./sounds";

describe("sounds", () => {
  it("has unique ids", () => {
    const ids = SOUNDS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("includes the default sound", () => {
    expect(isSoundId(DEFAULT_SOUND)).toBe(true);
  });

  it("maps an id to its Strudel name", () => {
    expect(getSound("saw")?.strudel).toEqual({ s: "sawtooth" });
    expect(getSound("tr909-bd")?.strudel).toEqual({ s: "bd", bank: "RolandTR909" });
  });

  it("matches the server's copy of the ids (server/app/sounds.py)", () => {
    const py = readFileSync(fileURLToPath(new URL("../../../server/app/sounds.py", import.meta.url)), "utf8");
    const serverIds = [...py.matchAll(/^\s+"([^"]+)",$/gm)].map((m) => m[1]);
    expect(new Set(serverIds)).toEqual(new Set(SOUNDS.map((s) => s.id)));
  });

  it("rejects Strudel names and object keys that aren't ids", () => {
    expect(isSoundId("sawtooth")).toBe(false);
    expect(isSoundId("toString")).toBe(false);
  });
});
