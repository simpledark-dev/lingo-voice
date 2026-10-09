"use client";

import { useState } from "react";

function GoogleMark() {
  // Placeholder mark; swap for the official asset when Google sign-in ships.
  return (
    <span className="lv-google-mark" aria-hidden>
      G
    </span>
  );
}

export function WelcomeScreen({ onGuest }: { onGuest: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guest = async () => {
    setBusy(true);
    setError(null);
    try {
      await onGuest();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not continue as guest");
      setBusy(false);
    }
  };

  return (
    <main className="lv-page lv-center lv-welcome-page" data-testid="welcome-screen">
      <div className="lv-welcome">
        <div className="lv-wordmark">Lingo</div>
        <h1>
          Practice speaking <span className="lv-accent-text">with real people</span>
        </h1>
        <p className="lv-muted">Join a live room, listen, raise your hand, read a passage aloud and get feedback from the host.</p>
        <ul className="lv-welcome-points">
          <li>Live rooms in 8 languages, beginner to advanced</li>
          <li>Raise your hand, get called up, read aloud</li>
          <li>Chat and react while you listen</li>
        </ul>
        <div className="lv-welcome-actions">
          <button className="lv-btn lv-btn-primary lv-btn-large" data-testid="guest-continue" disabled={busy} onClick={() => void guest()}>
            {busy ? "Setting you up…" : "Continue as guest"}
          </button>
          <button className="lv-btn lv-btn-large lv-btn-google" data-testid="google-login" disabled title="Coming soon">
            <GoogleMark /> Continue with Google <span className="lv-tag">Coming soon</span>
          </button>
        </div>
        {error && (
          <p className="lv-small" style={{ color: "var(--lv-danger)" }} role="alert">
            {error}
          </p>
        )}
        <p className="lv-muted lv-small">Guests get a random name you can change anytime. Signing in with Google will keep your history across devices.</p>
      </div>
    </main>
  );
}
