import { defineConfig } from "@playwright/test";
import path from "node:path";

const TONE_WAV = path.resolve(__dirname, "e2e/.fixtures/tone.wav");

/**
 * End-to-end tests run two or more real Chromium clients against a LOCAL LiveKit
 * server (`livekit-server --dev`) and a local Next.js dev server. Chromium is
 * started with a fake microphone so the tests exercise real audio publish /
 * subscribe paths (RTP packets, audio energy) without hardware.
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    permissions: ["microphone"],
    launchOptions: {
      args: [
        "--use-fake-ui-for-media-stream",
        "--use-fake-device-for-media-stream",
        `--use-file-for-fake-audio-capture=${TONE_WAV}`,
        "--autoplay-policy=no-user-gesture-required",
      ],
    },
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "livekit-server --dev --node-ip 127.0.0.1",
      url: "http://127.0.0.1:7880/",
      reuseExistingServer: true,
      timeout: 30_000,
    },
    {
      // Override with E2E_SERVER_CMD, e.g. "pnpm exec next start -p 3100" when a dev server is already running.
      command: process.env.E2E_SERVER_CMD ?? `pnpm exec next dev -p ${PORT}`,
      url: `${BASE_URL}/api/health`,
      reuseExistingServer: true,
      timeout: 180_000,
      env: {
        LIVEKIT_URL: "ws://127.0.0.1:7880",
        LIVEKIT_API_KEY: "devkey",
        LIVEKIT_API_SECRET: "secret",
        LOG_LEVEL: "warn",
      },
    },
  ],
});
