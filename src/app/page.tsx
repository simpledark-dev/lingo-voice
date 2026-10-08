import { JoinForm } from "./JoinForm";

export default function HomePage() {
  return (
    <main className="page narrow">
      <header className="card">
        <div className="eyebrow">lingo-voice</div>
        <h1>Voice test session</h1>
        <p className="muted">
          Create a session, send the link to friends, and talk. This is the real-time voice foundation; the product
          UI comes later.
        </p>
      </header>
      <JoinForm />
    </main>
  );
}
