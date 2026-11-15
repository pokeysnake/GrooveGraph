"use client";
import { useState, type KeyboardEvent } from "react";
import { Handle, Position, useStore, type NodeProps } from "@xyflow/react";
import "./filter-node.css";
import "./arrange-node.css";

import { DEFAULT_BARS } from "@/model/compile";
import { MAX_BARS } from "@/model/applyOp";
import { useUpdateNodeData } from "@/canvas/dispatch";
import { usePartRef } from "@/canvas/partRefs";

type Section = { id: string; label: string };

/** the Notes names upstream of a node, top to bottom, e.g. "Bass + Kick" ("Section" when there are none) */
function upstreamNames(
  start: string,
  nodes: Map<string, { type?: string; data: Record<string, unknown>; y: number }>,
  feeders: Map<string, string[]>,
): string {
  const names: { name: string; y: number }[] = [];
  const seen = new Set<string>();
  const stack = [start];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const n = nodes.get(id);
    if (n?.type === "notes") names.push({ name: String(n.data.name ?? "Notes"), y: n.y });
    stack.push(...(feeders.get(id) ?? []));
  }
  names.sort((a, b) => a.y - b.y);
  return names.length > 0 ? names.map((n) => n.name).join(" + ") : "Section";
}

/** this Arrange's inputs, ordered by canvas y like the compiler, each labelled by its upstream Notes.
 *  Returns a joined string from the store selector so React Flow only re-renders when a label or order changes. */
function useSections(id: string): Section[] {
  const key = useStore((s) => {
    const nodes = new Map(
      s.nodes.map((n) => [n.id, { type: n.type, data: n.data as Record<string, unknown>, y: n.position.y }]),
    );
    const feeders = new Map<string, string[]>();
    for (const e of s.edges) feeders.set(e.target, [...(feeders.get(e.target) ?? []), e.source]);
    const inputs = (feeders.get(id) ?? [])
      .filter((src) => nodes.has(src))
      .sort((a, b) => nodes.get(a)!.y - nodes.get(b)!.y || (a < b ? -1 : 1));
    return JSON.stringify(inputs.map((src) => ({ id: src, label: upstreamNames(src, nodes, feeders) })));
  });
  return JSON.parse(key) as Section[];
}

const blurOnEnter = (e: KeyboardEvent<HTMLInputElement>) => {
  if (e.key === "Enter") e.currentTarget.blur();
};

function BarsField({ value, onCommit }: { value: number; onCommit: (n: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? String(value);
  const n = Number(text);
  const ok = Number.isInteger(n) && n >= 1 && n <= MAX_BARS;
  return (
    <input
      type="number"
      className="filter-node__input arrange-node__bars nodrag"
      min={1} max={MAX_BARS} step={1}
      value={text}
      aria-label="Bars"
      aria-invalid={!ok}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (ok && n !== value) onCommit(n);
        setDraft(null);
      }}
      onKeyDown={blurOnEnter}
    />
  );
}

export default function ArrangeNode({ id, data }: NodeProps) {
  const update = useUpdateNodeData(id);
  const ref = usePartRef(id);
  const sections = useSections(id);
  const bars = (data.bars as Record<string, number> | undefined) ?? {};

  // the whole map goes in one op; keys for inputs that are gone are dropped on the next edit
  const setBars = (src: string, n: number) => {
    const next: Record<string, number> = {};
    for (const s of sections) next[s.id] = s.id === src ? n : (bars[s.id] ?? DEFAULT_BARS);
    update({ bars: next });
  };

  const total = sections.reduce((sum, s) => sum + (bars[s.id] ?? DEFAULT_BARS), 0);

  return (
    <div className="filter-node arrange-node">
      <Handle type="target" position={Position.Left} />

      <div className="filter-node__header">
        <div className="filter-node__icon" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="6" width="6" height="10" />
            <rect x="9" y="6" width="11" height="10" />
          </svg>
        </div>
        <div className="filter-node__titles">
          <span className="filter-node__eyebrow">Arrange<span className="node-ref">{ref}</span></span>
          <span className="arrange-node__sub">
            {sections.length > 0 ? `${total} bars, then loops` : "plug chains in"}
          </span>
        </div>
        <span className="arrange-node__out" title="Plays through the Output without a cable">📶 OUT</span>
      </div>

      <ol className="arrange-node__list">
        {sections.map((s, i) => (
          <li key={s.id} className="arrange-node__row">
            <span className="arrange-node__num">{i + 1}</span>
            <span className="arrange-node__label" title={s.label}>{s.label}</span>
            <BarsField value={bars[s.id] ?? DEFAULT_BARS} onCommit={(n) => setBars(s.id, n)} />
            <span className="filter-node__unit">bars</span>
          </li>
        ))}
        {sections.length === 0 && <li className="arrange-node__empty">Each input becomes a section, top to bottom</li>}
      </ol>
    </div>
  );
}
