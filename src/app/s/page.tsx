import Link from "next/link";
import { JoinForm } from "./JoinForm";

/** Voice diagnostics harness (kept from the infrastructure pass). */
export default function DiagnosticsHome() {
  return (
    <main className="page narrow">
      <header className="card">
        <div className="eyebrow">lingo-voice · diagnostics</div>
        <h1>Connection test session</h1>
        <p className="muted">
          A bare voice session with stats, event log and failure simulation. Use it to debug audio on a device.{" "}
          <Link href="/">Back to the rooms</Link>.
        </p>
      </header>
      <JoinForm />
    </main>
  );
}
