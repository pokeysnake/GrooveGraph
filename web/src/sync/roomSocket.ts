import type { Doc, Op } from "@/model/types";
import { docFromOps, parseServerMessage } from "./messages";
import type { Claims, ClientMessage, ClientOpMessage, RejectMessage, ServerOpMessage } from "./protocol";

export type Status = "connecting" | "open" | "closed";

export type SocketLike = {
  readyState: number;
  onopen: (() => void) | null;
  onmessage: ((e: { data: unknown }) => void) | null;
  onclose: ((e?: { code?: number }) => void) | null;
  send(data: string): void;
  close(): void;
};
export type SocketCtor = new (url: string) => SocketLike;

export type Handlers = {
  /** the room's doc, the id the server gave this connection (to spot our own echoes), and the op-log version */
  onSnapshot(doc: Doc, clientId: string, version: number): void;
  /** the whole message: the optimistic layer needs the sender's clientId and clientSeq */
  onOp(msg: ServerOpMessage): void;
  onReject(msg: RejectMessage): void;
  onStatus(status: Status): void;
  /** who is dragging what: from the snapshot on join, then every time the map changes */
  onClaims?(claims: Claims): void;
  /** the server doesn't know this room (it restarted and lost it): rebuild it, then the socket rejoins.
   *  Without this the socket just keeps retrying. */
  onLost?(): Promise<void>;
};

/** send() returns the clientSeq the op went out with, or null if the socket wasn't open (op dropped) */
export type RoomSocket = {
  send(op: Op): number | null;
  /** drag claims: dropped silently while the socket isn't open (the server frees claims on disconnect anyway) */
  claim(nodeIds: string[]): void;
  release(nodeIds: string[]): void;
  close(): void;
};

const OPEN = 1;

/** close code the server sends for a room it doesn't have (main.py) */
export const ROOM_NOT_FOUND = 4404;

/** wait before reconnect attempt n (0, 1, 2...): 0.5 s, 1 s, 2 s ... capped at 30 s, then a random 50-100% of that
 *  so a server restart doesn't get every client knocking at the same millisecond (the "thundering herd") */
export function backoffMs(attempt: number, rand: () => number = Math.random): number {
  const base = Math.min(30_000, 500 * 2 ** attempt);
  return Math.round(base * (0.5 + rand() / 2));
}

/** lagMs (dev testing only): hold every outgoing op this long before it leaves, so one person can
 *  create races between two tabs. The op still shows instantly; only the server hears it late. */
export function connectRoom(
  url: string,
  handlers: Handlers,
  Ctor: SocketCtor = WebSocket as unknown as SocketCtor,
  lagMs = 0,
): RoomSocket {
  let ws: SocketLike;
  let seq = 0;
  let attempt = 0;          // failed connects in a row; reset once one opens
  let stopped = false;      // close() was called: never reconnect after that
  let timer: ReturnType<typeof setTimeout> | undefined;

  /** each (re)connect is a brand new socket. Nothing carries over: the snapshot it receives replaces the doc and
   *  clears pending ops (syncReducer "snapshot"), and the server gives the new connection a new clientId. */
  function open() {
    ws = new Ctor(url);
    handlers.onStatus("connecting");
    ws.onopen = () => {
      attempt = 0;
      handlers.onStatus("open");
    };
    ws.onclose = (e) => {
      if (stopped) return;
      handlers.onStatus("closed");
      if (e?.code === ROOM_NOT_FOUND && handlers.onLost) {
        // rebuild first (it may fail: the server is still down, or our copy was refused); either way rejoin with backoff
        handlers.onLost().catch(() => {}).finally(retry);
      } else retry();
    };
    ws.onmessage = (e) => {
      if (typeof e.data !== "string") return;
      const msg = parseServerMessage(e.data);
      if (!msg) return;
      if (msg.type === "snapshot") {
        handlers.onSnapshot(docFromOps(msg.ops), msg.clientId, msg.version);
        handlers.onClaims?.(msg.claims ?? {});
      } else if (msg.type === "claims") handlers.onClaims?.(msg.claims);
      else if (msg.type === "reject") handlers.onReject(msg);
      else handlers.onOp(msg);
    };
  }

  function retry() {
    if (stopped) return;
    timer = setTimeout(open, backoffMs(attempt++));
  }

  open();
  // every outgoing message takes the same path (lag included), so they reach the server in the order
  // they were sent: a drop's moveNodes always lands before its release
  const ship = (msg: ClientMessage) => {
    const text = JSON.stringify(msg);
    if (lagMs > 0) setTimeout(() => ws.readyState === OPEN && ws.send(text), lagMs);
    else ws.send(text);
  };
  return {
    send(op) {
      if (ws.readyState !== OPEN) return null;
      const msg: ClientOpMessage = { type: "op", op, clientSeq: ++seq };
      ship(msg);
      return msg.clientSeq;
    },
    claim(nodeIds) {
      if (ws.readyState === OPEN && nodeIds.length) ship({ type: "claim", nodeIds });
    },
    release(nodeIds) {
      if (ws.readyState === OPEN && nodeIds.length) ship({ type: "release", nodeIds });
    },
    close() {
      stopped = true;
      clearTimeout(timer);
      ws.onopen = ws.onmessage = ws.onclose = null;
      ws.close();
    },
  };
}
