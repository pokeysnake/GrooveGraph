import { describe, it, expect, vi } from "vitest";
import { SERVER_HTTP, wakeServer } from "./config";

describe("wakeServer", () => {
  it("pings /health once without needing CORS", () => {
    const f = vi.fn().mockResolvedValue(new Response());
    wakeServer(f as unknown as typeof fetch);
    expect(f).toHaveBeenCalledWith(`${SERVER_HTTP}/health`, { mode: "no-cors" });
  });

  it("swallows a failed ping (the server being down is not an error on page load)", async () => {
    const f = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    expect(() => wakeServer(f as unknown as typeof fetch)).not.toThrow();
    await Promise.resolve(); // let the rejection settle; an unhandled one would fail the run
  });
});
