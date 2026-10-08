"use client";

import { useEffect, type ReactNode } from "react";
import { Icon } from "./Icon";

export interface MenuItem {
  label: string;
  onSelect: () => void | Promise<void>;
  tone?: "default" | "danger";
  testId?: string;
}

/** Bottom sheet on phones, small dialog on desktop. */
export function ActionMenu({ title, subtitle, items, onClose, children }: { title: string; subtitle?: string; items: MenuItem[]; onClose: () => void; children?: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="lv-sheet-backdrop" onClick={onClose} role="presentation">
      <div className="lv-sheet" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="lv-sheet-head">
          <div>
            <div className="lv-sheet-title">{title}</div>
            {subtitle && <div className="lv-sheet-sub">{subtitle}</div>}
          </div>
          <button className="lv-iconbtn" onClick={onClose} aria-label="Close">
            <Icon name="x" />
          </button>
        </div>
        {children}
        {items.length > 0 && (
          <div className="lv-menu">
            {items.map((item) => (
              <button
                key={item.label}
                className={`lv-menu-item${item.tone === "danger" ? " is-danger" : ""}`}
                data-testid={item.testId}
                onClick={() => {
                  // Close first: a handler may open another sheet, and the later state update must win.
                  onClose();
                  void item.onSelect();
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
