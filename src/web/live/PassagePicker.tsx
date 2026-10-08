"use client";

import { useState } from "react";
import { LEVELS, type LanguageCode, type Level, type Passage } from "@/core/room-model";
import { languageLabel } from "@/core/room-model";
import { libraryPassage, passagesFor } from "@/core/passages";
import { Icon } from "./Icon";

export function PassagePicker({
  language,
  level,
  current,
  onPick,
  onClose,
}: {
  language: LanguageCode;
  level: Level;
  current: Passage | null;
  onPick: (passage: Passage) => Promise<void>;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"library" | "custom">("library");
  const [filter, setFilter] = useState<Level | "all">(level);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const list = passagesFor(language, filter === "all" ? undefined : filter);

  const pick = async (passage: Passage) => {
    setBusy(true);
    try {
      await onPick(passage);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="lv-sheet-backdrop" onClick={onClose} role="presentation">
      <div className="lv-sheet lv-sheet-tall" role="dialog" aria-label="Choose a passage" onClick={(e) => e.stopPropagation()}>
        <div className="lv-sheet-head">
          <div>
            <div className="lv-sheet-title">Choose a passage</div>
            <div className="lv-sheet-sub">{languageLabel(language)}</div>
          </div>
          <button className="lv-iconbtn" onClick={onClose} aria-label="Close">
            <Icon name="x" />
          </button>
        </div>
        <div className="lv-tabs" role="tablist">
          <button role="tab" aria-selected={tab === "library"} className={tab === "library" ? "is-active" : ""} onClick={() => setTab("library")}>
            Library
          </button>
          <button role="tab" aria-selected={tab === "custom"} className={tab === "custom" ? "is-active" : ""} onClick={() => setTab("custom")}>
            Custom text
          </button>
        </div>
        {tab === "library" ? (
          <div className="lv-sheet-body">
            <div className="lv-chips">
              <button className={filter === "all" ? "is-active" : ""} onClick={() => setFilter("all")}>
                All levels
              </button>
              {LEVELS.map((l) => (
                <button key={l} className={filter === l ? "is-active" : ""} onClick={() => setFilter(l)}>
                  {l}
                </button>
              ))}
            </div>
            <ul className="lv-passage-list">
              {list.map((p) => {
                const selected = current?.id === p.id;
                return (
                  <li key={p.id}>
                    <button className={`lv-passage-option${selected ? " is-selected" : ""}`} disabled={busy} onClick={() => void pick(libraryPassage(p))} data-testid={`passage-${p.id}`}>
                      <div className="lv-passage-option-head">
                        <strong>{p.title}</strong>
                        <span className="lv-tag">{p.level}</span>
                        {selected && <Icon name="check" size={16} />}
                      </div>
                      <p>{p.text}</p>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <form
            className="lv-sheet-body lv-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!title.trim() || !text.trim()) return;
              void pick({ title: title.trim(), text: text.trim(), language, level, source: "custom" });
            }}
          >
            <label>
              Title
              <input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Ordering coffee" />
            </label>
            <label>
              Text
              <textarea value={text} maxLength={4000} rows={8} onChange={(e) => setText(e.target.value)} placeholder="Paste or write the passage learners will read aloud." />
            </label>
            <button type="submit" className="lv-btn lv-btn-primary" disabled={busy || !title.trim() || !text.trim()}>
              Use this passage
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
