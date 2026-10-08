"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { generateSessionId, isValidSessionId, normalizeSessionId } from "@/core/validation";
import { loadDisplayName, saveDisplayName } from "@/web/storage";

export function JoinForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(loadDisplayName() ?? "");
    setSessionId(generateSessionId());
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const id = normalizeSessionId(sessionId);
    if (!isValidSessionId(id)) {
      setError("Session ID must be 3-64 characters: letters, digits, '-' or '_'.");
      return;
    }
    const trimmed = name.trim();
    if (trimmed) saveDisplayName(trimmed);
    const query = trimmed ? `?name=${encodeURIComponent(trimmed)}` : "";
    router.push(`/s/${id}${query}`);
  };

  return (
    <form className="card form" onSubmit={submit}>
      <label>
        Display name
        <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
      </label>
      <label>
        Session ID
        <div className="inline">
          <input
            className="mono"
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            placeholder="k7mq-x2pa"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          <button type="button" onClick={() => setSessionId(generateSessionId())}>
            New
          </button>
        </div>
      </label>
      {error && <p className="error-text">{error}</p>}
      <button type="submit" className="primary">
        Open session
      </button>
      <p className="muted small">Anyone with the session link can join. Share it only with people you want in the room.</p>
    </form>
  );
}
