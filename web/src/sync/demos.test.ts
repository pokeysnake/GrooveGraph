import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { readSaveFile } from "./seed";
import { compile } from "@/model/compile";

// shared/fixtures/demos: patch files for the README GIF; load one with the sidebar's Load button
const DIR = join(__dirname, "../../../shared/fixtures/demos");
const files = readdirSync(DIR).filter((f) => f.endsWith(".json"));

describe("demo patches", () => {
  it("there are some", () => expect(files.length).toBeGreaterThan(0));

  it.each(files)("%s loads and compiles with no issues", (f) => {
    const r = readSaveFile(readFileSync(join(DIR, f), "utf8"));
    if (!r.ok) throw new Error(r.reason);
    const { code, issues } = compile(r.doc);
    expect(issues).toEqual([]);
    expect(code).not.toContain("silence");
  });
});
