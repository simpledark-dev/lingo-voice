export function LoadingScreen({ label = "Loading" }: { label?: string }) {
  return (
    <main className="lv-page lv-center lv-loading" aria-busy>
      <div className="lv-loading-inner">
        <div className="lv-wordmark">Lingo</div>
        <div className="lv-loading-dots" aria-hidden>
          <span />
          <span />
          <span />
        </div>
        <span className="lv-muted lv-small">{label}</span>
      </div>
    </main>
  );
}
