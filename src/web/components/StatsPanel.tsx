"use client";

import type { AudioStatsSnapshot, ParticipantSnapshot, VoiceSessionState } from "@/core/voice-session";

function fmt(value: number | null, suffix = ""): string {
  return value === null ? "–" : `${value}${suffix}`;
}

function Row({ label, s }: { label: string; s: AudioStatsSnapshot }) {
  return (
    <tr>
      <td>{label}</td>
      <td className="num">{fmt(s.packets)}</td>
      <td className="num">{fmt(s.packetsLost)}</td>
      <td className="num">{fmt(s.bitrateKbps, " kbps")}</td>
      <td className="num">{fmt(s.jitterMs, " ms")}</td>
      <td className="num">{fmt(s.rttMs, " ms")}</td>
      <td className="num">{s.totalAudioEnergy === null ? "–" : s.totalAudioEnergy.toFixed(2)}</td>
    </tr>
  );
}

export function StatsPanel({ stats, participants }: { stats: VoiceSessionState["stats"]; participants: ParticipantSnapshot[] }) {
  const remoteEntries = Object.entries(stats.remote);
  if (!stats.local && remoteEntries.length === 0) return null;
  const nameOf = (identity: string) => participants.find((p) => p.identity === identity)?.name ?? identity;
  return (
    <section className="card">
      <div className="section-head">
        <h2>Audio stats</h2>
        <span className="muted small">refreshes every 2 s</span>
      </div>
      <div className="table-wrap">
        <table className="stats">
          <thead>
            <tr>
              <th>Stream</th>
              <th className="num">packets</th>
              <th className="num">lost</th>
              <th className="num">bitrate</th>
              <th className="num">jitter</th>
              <th className="num">rtt</th>
              <th className="num">energy</th>
            </tr>
          </thead>
          <tbody>
            {stats.local && <Row label="your mic (sent)" s={stats.local} />}
            {remoteEntries.map(([identity, s]) => (
              <Row key={identity} label={`${nameOf(identity)} (received)`} s={s} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
