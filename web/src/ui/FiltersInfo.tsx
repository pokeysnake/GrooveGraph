"use client";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { motion } from "motion/react";
import { FILTERS, FILTER_INFO, Q_INFO, type FilterKind } from "@/model/filters";
import type { Rect } from "./NotesEditor";
import "./notes-editor.css";
import "./filters-info.css";

const MORPH = { duration: 0.3, ease: [0.2, 0.8, 0.2, 1] as const };
const KINDS = Object.keys(FILTERS) as FilterKind[];

/**
 * Help popup for the sidebar's Filters list: what each effect does and what turning it up or down sounds like.
 * Same open/close morph as NotesEditor: a blank ghost card sits on the "i" button, then swaps for the dialog
 * with the same layoutId so it grows out of the button, and shrinks back into it on close.
 */
export default function FiltersInfo({ from, onClose }: { from: Rect | null; onClose: () => void }) {
  const [phase, setPhase] = useState<"opening" | "open" | "closing">(from ? "opening" : "open");
  const layoutId = useId();
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setPhase("open"));
    return () => cancelAnimationFrame(raf);
  }, []);
  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);
  // focus lands in the dialog so Esc works straight away
  useEffect(() => { if (phase === "open") closeBtn.current?.focus(); }, [phase]);

  const close = () => {
    if (!from) return onClose();
    if (phase === "closing") return;
    setPhase("closing");
    closeTimer.current = setTimeout(onClose, MORPH.duration * 1000);
  };

  const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };

  return (
    <>
      <motion.div className="notes-editor__backdrop" onMouseDown={close}
        initial={{ opacity: 0 }} animate={{ opacity: phase === "open" ? 1 : 0 }} transition={MORPH} />

      {phase === "open" ? (
        <div className="notes-editor__center">
          <motion.div layoutId={layoutId} transition={MORPH} style={{ borderRadius: 14 }}
            className="notes-editor filters-info" role="dialog" aria-label="What the filters do" onKeyDown={onKeyDown}>
            <motion.div className="notes-editor__content"
              initial={from ? { opacity: 0 } : false} animate={{ opacity: 1 }} transition={{ delay: 0.15, duration: 0.15 }}>
              <h3 className="filters-info__title">Filters &amp; effects</h3>

              <ul className="filters-info__list">
                {KINDS.map((k) => (
                  <li key={k} className="filters-info__item">
                    <div className="filters-info__head">
                      <span className="filters-info__name">{FILTERS[k].label}</span>
                      <span className="filters-info__range">
                        {FILTERS[k].min} to {FILTERS[k].max}{FILTERS[k].unit && ` ${FILTERS[k].unit}`}
                      </span>
                    </div>
                    <p className="filters-info__about">{FILTER_INFO[k].about}</p>
                    <ul className="filters-info__dirs">
                      <li><b>Higher</b> = {FILTER_INFO[k].higher}</li>
                      <li><b>Lower</b> = {FILTER_INFO[k].lower}</li>
                    </ul>
                  </li>
                ))}
                <li className="filters-info__item">
                  <div className="filters-info__head">
                    <span className="filters-info__name">Q</span>
                    <span className="filters-info__range">on Low-pass, High-pass, Band-pass</span>
                  </div>
                  <p className="filters-info__about">{Q_INFO.about}</p>
                  <ul className="filters-info__dirs">
                    <li><b>Higher</b> = {Q_INFO.higher}</li>
                    <li><b>Lower</b> = {Q_INFO.lower}</li>
                  </ul>
                </li>
              </ul>

              <div className="notes-editor__actions">
                <span className="notes-editor__hint">Esc to close</span>
                <button ref={closeBtn} type="button" onClick={close}>Close</button>
              </div>
            </motion.div>
          </motion.div>
        </div>
      ) : from && (
        <motion.div layoutId={layoutId} transition={MORPH} className="notes-editor notes-editor--ghost"
          style={{ ...from, borderRadius: 14 }} />
      )}
    </>
  );
}
