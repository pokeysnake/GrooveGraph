import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { readSaveFile } from "./seed";
import { compile } from "@/model/compile";
import { EXAMPLES } from "@/model/examples";

// shared/fixtures/demos: the sidebar's Examples menu (model/examples.ts), also handy for the README GIF
const DIR = join(__dirname, "../../../shared/fixtures/demos");
const files = readdirSync(DIR).filter((f) => f.endsWith(".json"));

describe("demo patches", () => {
  it("there are some", () => expect(files.length).toBeGreaterThan(0));

  it("every one is in the Examples menu, and the menu has nothing else", () => {
    expect(EXAMPLES.map((e) => `${e.id}.json`).sort()).toEqual([...files].sort());
  });

  it.each(EXAMPLES)("$name: the menu's ops are the file's ops", (ex) => {
    const file = JSON.parse(readFileSync(join(DIR, `${ex.id}.json`), "utf8")) as { ops: unknown[] };
    expect(ex.ops).toEqual(file.ops);
  });

  it.each(files)("%s loads and compiles with no issues", (f) => {
    const r = readSaveFile(readFileSync(join(DIR, f), "utf8"));
    if (!r.ok) throw new Error(r.reason);
    const { code, issues } = compile(r.doc);
    expect(issues).toEqual([]);
    expect(code).not.toContain("silence");
  });
});
