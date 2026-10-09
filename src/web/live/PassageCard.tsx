"use client";

import type { Passage } from "@/core/room-model";
import { Icon } from "./Icon";

export function PassageCard({
  passage,
  canEdit,
  onEdit,
  collapsible,
  expanded,
  onToggle,
}: {
  passage: Passage | null;
  canEdit: boolean;
  onEdit: () => void;
  collapsible: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const open = !collapsible || expanded;
  return (
    <section className={`lv-passage${open ? " is-open" : ""}`} aria-label="Reading passage" data-testid="passage-card" data-open={open}>
      <div className="lv-passage-head">
        <button type="button" className="lv-passage-kicker" onClick={collapsible ? onToggle : undefined} data-testid="passage-toggle" aria-expanded={open}>
          <Icon name="book" size={15} />
          <span>Passage</span>
          {passage?.level && <span className="lv-tag">{passage.level}</span>}
          {collapsible && <Icon name="chevron-left" size={16} className={`lv-passage-chevron${open ? " is-open" : ""}`} />}
        </button>
        {canEdit && (
          <button className="lv-btn lv-btn-small lv-btn-ghost" onClick={onEdit} data-testid="change-passage">
            Change
          </button>
        )}
      </div>
      {passage ? (
        <>
          <h2 className="lv-passage-title" data-testid="passage-title">
            {passage.title}
          </h2>
          <p className={`lv-passage-text${open ? "" : " is-clamped"}`} lang={passage.language} data-testid="passage-text">
            {passage.text}
          </p>
          {collapsible && !open && (
            <button type="button" className="lv-linkbtn lv-passage-more" onClick={onToggle}>
              Read the full passage
            </button>
          )}
        </>
      ) : (
        <p className="lv-muted">{canEdit ? "Pick a passage for learners to read." : "The host has not chosen a passage yet."}</p>
      )}
    </section>
  );
}
