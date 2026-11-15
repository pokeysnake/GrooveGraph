import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Doc, Op } from "@/model/types";
import { starterDoc, starterOps } from "@/model/starter";
import type { Claims, RejectMessage, ServerOpMessage } from "./protocol";
import { backoffMs, connectRoom, ROOM_NOT_FOUND, type SocketLike, type Status } from "./roomSocket";

class FakeSocket implements SocketLike {
  static last: FakeSocket;
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onclose: ((e?: { code?: number }) => void) | null = null;
  sent: string[] = [];
  closed = false;
  constructor(public url: string) {
    FakeSocket.last = this;
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.closed = true;
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  receive(msg: unknown) {
    this.onmessage?.({ data: typeof msg === "string" ? msg : JSON.stringify(msg) });
  }
}

const bpm = (n: number): Op => ({ type: "setSetting", opId: `t${n}`, patch: { bpm: n } });

let docs: Doc[];
let ops: ServerOpMessage[];
let rejects: RejectMessage[];
let ids: string[];
let statuses: Status[];
let claimMaps: Claims[];
const connect = () =>
  connectRoom(
    "ws://x/ws/r1",
    {
      onSnapshot: (d, id) => {
        docs.push(d);
        ids.push(id);
      },
      onOp: (m) => ops.push(m),
      onReject: (m) => rejects.push(m),
      onStatus: (s) => statuses.push(s),
      onClaims: (c) => claimMaps.push(c),
    },
    FakeSocket,
  );

beforeEach(() => {
  docs = [];
  ops = [];
  rejects = [];
  ids = [];
  statuses = [];
  claimMaps = [];
});

describe("connectRoom", () => {
  it("connects to the url and reports connecting, then open", () => {
    connect();
    FakeSocket.last.open();
    expect(FakeSocket.last.url).toBe("ws://x/ws/r1");
    expect(statuses).toEqual(["connecting", "open"]);
  });

  it("turns a snapshot into a doc", () => {
    connect();
    FakeSocket.last.receive({ type: "snapshot", version: starterOps.length, clientId: "c1", ops: starterOps });
    expect(docs).toEqual([starterDoc()]);
    expect(ids).toEqual(["c1"]);
  });

  it("passes a broadcast op to onOp, with the sender's clientId and clientSeq", () => {
    connect();
    const msg = { type: "op", op: bpm(100), version: 1, clientId: "c2", clientSeq: 1 };
    FakeSocket.last.receive(msg);
    expect(ops).toEqual([msg]);
  });

  it("passes a reject to onReject", () => {
    connect();
    const msg = { type: "reject", clientSeq: 3, reason: "bpm must be 40-240" };
    FakeSocket.last.receive(msg);
    expect(rejects).toEqual([msg]);
    expect(ops).toEqual([]);
  });

  it("ignores garbage", () => {
    connect();
    FakeSocket.last.receive("hello");
    FakeSocket.last.receive({ type: "chat" });
    expect(docs).toEqual([]);
    expect(ops).toEqual([]);
  });

  it("drops a send while the socket isn't open", () => {
    const room = connect();
    expect(room.send(bpm(100))).toBeNull();
    expect(FakeSocket.last.sent).toEqual([]);
  });

  it("sends {type, op, clientSeq} counting up from 1", () => {
    const room = connect();
    FakeSocket.last.open();
    expect(room.send(bpm(100))).toBe(1);
    expect(room.send(bpm(110))).toBe(2);
    expect(FakeSocket.last.sent.map((s) => JSON.parse(s))).toEqual([
      { type: "op", op: bpm(100), clientSeq: 1 },
      { type: "op", op: bpm(110), clientSeq: 2 },
    ]);
  });

  it("with lag, the seq comes back at once but the op leaves only after the delay", () => {
    vi.useFakeTimers();
    const handlers = { onSnapshot() {}, onOp() {}, onReject() {}, onStatus() {} };
    const room = connectRoom("ws://x/ws/r1", handlers, FakeSocket, 3000);
    FakeSocket.last.open();
    expect(room.send(bpm(100))).toBe(1);
    expect(FakeSocket.last.sent).toEqual([]);
    vi.advanceTimersByTime(3000);
    expect(FakeSocket.last.sent).toHaveLength(1);
    vi.useRealTimers();
  });

  it("reports closed when the server drops", () => {
    const room = connect();
    FakeSocket.last.open();
    FakeSocket.last.onclose?.();
    expect(statuses).toEqual(["connecting", "open", "closed"]);
    room.close(); // cancel the reconnect it scheduled, so it can't fire during a later test
  });

  it("close() closes the socket and silences its handlers", () => {
    const room = connect();
    const ws = FakeSocket.last;
    room.close();
    expect(ws.closed).toBe(true);
    expect(ws.onmessage).toBeNull();
    expect(ws.onclose).toBeNull();
  });
});
describe("connectRoom: drag claims", () => {
  const sent = () => FakeSocket.last.sent.map((s) => JSON.parse(s));

  it("a snapshot hands over the room's claims (none = empty map)", () => {
    connect();
    FakeSocket.last.receive({ type: "snapshot", version: 0, clientId: "c1", ops: [], claims: { n1: "c2" } });
    FakeSocket.last.receive({ type: "snapshot", version: 0, clientId: "c1", ops: [] });
    expect(claimMaps).toEqual([{ n1: "c2" }, {}]);
  });

  it("a claims message goes to onClaims, not onOp", () => {
    connect();
    FakeSocket.last.receive({ type: "claims", claims: { n1: "c2" } });
    expect(claimMaps).toEqual([{ n1: "c2" }]);
    expect(ops).toEqual([]);
  });

  it("claim and release send their node ids", () => {
    const room = connect();
    FakeSocket.last.open();
    room.claim(["n1", "n2"]);
    room.release(["n1", "n2"]);
    expect(sent()).toEqual([
      { type: "claim", nodeIds: ["n1", "n2"] },
      { type: "release", nodeIds: ["n1", "n2"] },
    ]);
  });

  it("sends nothing for an empty list, or while the socket isn't open", () => {
    const room = connect();
    room.claim(["n1"]);
    FakeSocket.last.open();
    room.claim([]);
    room.release([]);
    expect(FakeSocket.last.sent).toEqual([]);
  });

  it("claims don't use up an op clientSeq", () => {
    const room = connect();
    FakeSocket.last.open();
    room.claim(["n1"]);
    expect(room.send(bpm(100))).toBe(1);
  });

  it("with lag, claim, move and release still leave in the order they were sent", () => {
    vi.useFakeTimers();
    const handlers = { onSnapshot() {}, onOp() {}, onReject() {}, onStatus() {} };
    const room = connectRoom("ws://x/ws/r1", handlers, FakeSocket, 3000);
    FakeSocket.last.open();
    room.claim(["n1"]);
    room.send(bpm(100));
    room.release(["n1"]);
    expect(FakeSocket.last.sent).toEqual([]);
    vi.advanceTimersByTime(3000);
    expect(sent().map((m) => m.type)).toEqual(["claim", "op", "release"]);
    vi.useRealTimers();
  });
});

describe("connectRoom: auto-reconnect", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("backoff doubles from 0.5 s, caps at 30 s, and jitters to 50-100%", () => {
    expect([0, 1, 2, 3].map((n) => backoffMs(n, () => 1))).toEqual([500, 1000, 2000, 4000]);
    expect(backoffMs(20, () => 1)).toBe(30_000);
    expect(backoffMs(0, () => 0)).toBe(250);
  });

  it("a dropped socket comes back by itself and the new one gets the fresh snapshot", () => {
    connect();
    const first = FakeSocket.last;
    first.open();
    first.onclose?.({ code: 1006 });
    expect(FakeSocket.last).toBe(first); // nothing yet: it waits out the backoff
    vi.advanceTimersByTime(500);
    expect(FakeSocket.last).not.toBe(first);
    expect(FakeSocket.last.url).toBe("ws://x/ws/r1");
    expect(statuses).toEqual(["connecting", "open", "closed", "connecting"]);
  });

  it("each failed try waits longer, and a successful open resets the wait", () => {
    vi.spyOn(Math, "random").mockReturnValue(1);
    connect();
    FakeSocket.last.onclose?.({ code: 1006 }); // never opened: server down
    vi.advanceTimersByTime(500);
    const second = FakeSocket.last;
    second.onclose?.({ code: 1006 });
    vi.advanceTimersByTime(999);
    expect(FakeSocket.last).toBe(second); // second wait is 1 s, not 0.5 s
    vi.advanceTimersByTime(1);
    FakeSocket.last.open(); // back up
    const third = FakeSocket.last;
    third.onclose?.({ code: 1006 });
    vi.advanceTimersByTime(500);
    expect(FakeSocket.last).not.toBe(third); // reset to 0.5 s
    vi.restoreAllMocks();
  });

  it("a lost room (4404) is rebuilt first, then the socket rejoins", async () => {
    const onLost = vi.fn().mockResolvedValue(undefined);
    connectRoom("ws://x/ws/r1", { onSnapshot() {}, onOp() {}, onReject() {}, onStatus() {}, onLost }, FakeSocket);
    const first = FakeSocket.last;
    first.onclose?.({ code: ROOM_NOT_FOUND });
    expect(onLost).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(500);
    expect(FakeSocket.last).not.toBe(first);
  });

  it("a failed rebuild still retries (the server may just be booting)", async () => {
    const onLost = vi.fn().mockRejectedValue(new Error("can't reach the server"));
    connectRoom("ws://x/ws/r1", { onSnapshot() {}, onOp() {}, onReject() {}, onStatus() {}, onLost }, FakeSocket);
    const first = FakeSocket.last;
    first.onclose?.({ code: ROOM_NOT_FOUND });
    await vi.advanceTimersByTimeAsync(500);
    expect(FakeSocket.last).not.toBe(first);
  });

  it("close() stops any pending reconnect", () => {
    const room = connect();
    const first = FakeSocket.last;
    first.onclose?.({ code: 1006 });
    room.close();
    vi.advanceTimersByTime(60_000);
    expect(FakeSocket.last).toBe(first);
  });
});
