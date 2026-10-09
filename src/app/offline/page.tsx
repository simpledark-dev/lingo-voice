import Link from "next/link";

export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main className="lv-page lv-center">
      <div className="lv-card lv-endcard">
        <div className="lv-wordmark">Lingo</div>
        <h1>You&apos;re offline</h1>
        <p className="lv-muted">Live rooms need a connection. Check your network and try again.</p>
        <div className="lv-row">
          <Link className="lv-btn lv-btn-primary" href="/">
            Try again
          </Link>
        </div>
      </div>
    </main>
  );
}
