import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

export const FIXTURE_DIR = path.resolve(__dirname, ".fixtures");
export const TONE_WAV = path.join(FIXTURE_DIR, "tone.wav");

/**
 * Generates a speech-like test signal (tone bursts with gaps) that Chromium feeds
 * into the fake microphone. Bursts + silence make active-speaker detection and
 * DTX behave like a real talker instead of a constant tone.
 */
function writeToneWav(file: string): void {
  const sampleRate = 48_000;
  const seconds = 8;
  const total = sampleRate * seconds;
  const pcm = new Int16Array(total);
  const burstMs = 450;
  const gapMs = 250;
  const freqs = [440, 554, 659, 523, 392];
  const burst = Math.round((sampleRate * burstMs) / 1000);
  const gap = Math.round((sampleRate * gapMs) / 1000);
  let i = 0;
  let k = 0;
  while (i < total) {
    const f = freqs[k % freqs.length]!;
    for (let n = 0; n < burst && i < total; n++, i++) {
      const env = Math.min(1, n / 400, (burst - n) / 400); // short fade in/out
      pcm[i] = Math.round(0.6 * env * 32767 * Math.sin((2 * Math.PI * f * n) / sampleRate));
    }
    i += gap;
    k += 1;
  }
  const header = Buffer.alloc(44);
  const dataBytes = pcm.length * 2;
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataBytes, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataBytes, 40);
  writeFileSync(file, Buffer.concat([header, Buffer.from(pcm.buffer)]));
}

export default function globalSetup(): void {
  if (!existsSync(FIXTURE_DIR)) mkdirSync(FIXTURE_DIR, { recursive: true });
  if (!existsSync(TONE_WAV)) writeToneWav(TONE_WAV);
}
