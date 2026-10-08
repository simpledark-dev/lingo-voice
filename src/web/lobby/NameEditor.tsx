"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { PublicUser } from "@/core/lobby-model";

/** "You're <name> · Change" with an inline rename. */
export function NameEditor({ me, onRename }: { me: PublicUser | null; onRename: (name: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (me && !editing) setValue(me.displayName);
  }, [me, editing]);

  if (!me) return <span className="lv-muted lv-small">Signing you in…</span>;

  if (!editing) {
    return (
      <span className="lv-me">
        You&apos;re <strong data-testid="me-name">{me.displayName}</strong>
        <button className="lv-linkbtn" onClick={() => setEditing(true)} data-testid="rename-btn">
          Change
        </button>
        {me.kind === "guest" && <span className="lv-tag">guest</span>}
      </span>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await onRename(value.trim());
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not rename");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="lv-me lv-me-edit" onSubmit={submit}>
      <input data-testid="rename-input" value={value} maxLength={40} autoFocus onChange={(e) => setValue(e.target.value)} aria-label="Your name" />
      <button type="submit" className="lv-btn lv-btn-small lv-btn-primary" disabled={busy || !value.trim()} data-testid="rename-save">
        Save
      </button>
      <button type="button" className="lv-btn lv-btn-small lv-btn-ghost" onClick={() => setEditing(false)}>
        Cancel
      </button>
      {error && <span className="lv-small" style={{ color: "var(--lv-danger)" }}>{error}</span>}
    </form>
  );
}
