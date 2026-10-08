"use client";

import type { Passage } from "@/core/room-model";
import { Icon } from "./Icon";

export function PassageCard({ passage, canEdit, onEdit }: { passage: Passage | null; canEdit: boolean; onEdit: () => void }) {
  return (
    <section className="lv-passage" aria-label="Reading passage">
      <div className="lv-passage-head">
        <div className="lv-passage-kicker">
          <Icon name="book" size={16} /> Reading passage
          {passage?.level && <span className="lv-tag">{passage.level}</span>}
        </div>
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
          <p className="lv-passage-text" lang={passage.language} data-testid="passage-text">
            {passage.text}
          </p>
        </>
      ) : (
        <p className="lv-muted">{canEdit ? "Pick a passage for learners to read." : "The host has not chosen a passage yet."}</p>
      )}
    </section>
  );
}
