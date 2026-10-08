"use client";

import type { FloatingReaction } from "./useLiveRoom";

export function ReactionOverlay({ items }: { items: FloatingReaction[] }) {
  return (
    <div className="lv-float-layer" aria-hidden data-testid="reaction-overlay" data-count={items.length}>
      {items.map((r) => (
        <span key={r.id} className="lv-float" style={{ left: `${r.x}%` }}>
          {r.emoji}
        </span>
      ))}
    </div>
  );
}
