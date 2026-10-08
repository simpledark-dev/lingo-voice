# lingo-voice

Live language-practice rooms: a host picks a reading passage, learners listen, react and chat, raise a hand,
get invited on stage, read aloud over real-time voice and receive feedback. Built on LiveKit Cloud with a
Next.js app that is both frontend and backend.

The repository has two layers:

1. **Voice foundation** (`src/core`, `src/server`, `/s/...` diagnostics): secure token backend, a
   platform-independent session controller, reliability handling, a debug harness. Verified across devices.
2. **Product layer** (`/`, `/create`, `/room/...`): lobby, room creation, the live room with passage, stage,
   hand raising, chat, reactions and host moderation.

## The product

| Screen | What happens |
|---|---|
| `/` lobby | Lists every room that is live right now (title, language, level, host, how many people are inside). Refreshes every 5 s. |
| `/create` | Host picks language, level, title and a reading passage (built-in library in 8 languages and 3 levels, or custom text). |
| `/room/<id>` | The live room. Listeners hear the stage, chat, react and raise a hand. The host invites learners to speak, changes the passage, mutes or removes people, moderates chat, ends the room. |

Roles inside a room:

- **Host**: the creator. Speaks, and holds a secret *host key* that unlocks all moderation actions.
- **Speaker**: a learner the host invited. Can publish a microphone until removed from stage. Several speakers can be on stage at once.
- **Listener**: everyone else. Hears the stage, chats, reacts, raises a hand.

### How room state works (no database yet)

Everything real-time rides on LiveKit, so there is nothing else to run:

| State | Where it lives | Who writes it |
|---|---|---|
| Which rooms are live, how many people | LiveKit rooms themselves (`listRooms`) | LiveKit |
| Title, language, level, host, passage, stage list, chat-muted list | LiveKit **room metadata** (JSON, `src/core/room-model.ts`) | our server only |
| Who may publish audio / send chat | LiveKit **participant permissions** | our server only (`updateParticipant`) |
| Raised hand | the participant's own LiveKit **attribute** `lingo.hand` | the participant |
| Chat, reactions, message deletion | LiveKit **data messages** (`src/core/messages.ts`) | participants; deletes accepted only from the host identity |

Consequences worth knowing: rooms disappear from the lobby when empty (LiveKit closes them after 5 minutes
without participants), chat is not persisted (late joiners receive the host's last 50 messages over a
direct data message), and a learner who refreshes keeps their stage seat because the stage list is in
metadata. A real database only becomes necessary for history, profiles and scheduled rooms.

### Host authority without accounts

`POST /api/rooms` returns a random **host key** once; the browser keeps it in `localStorage` for that room
and sends it as `x-host-key` on `POST /api/rooms/<id>/host`. The server stores only a SHA-256 hash in the room
metadata. Every moderation action is applied by the server through LiveKit (permissions, metadata, mute,
remove, delete room), so a client without the key cannot fake any of it. When accounts arrive, the key
becomes "the authenticated user is the room's host" and nothing else changes.

### Product API (for a native client later)

| Endpoint | Purpose |
|---|---|
| `GET /api/rooms` | live rooms for the lobby |
| `POST /api/rooms` | create a room → `{ room, hostKey, hostIdentity }` |
| `GET /api/rooms/:id` | details for the join screen (404 when not live) |
| `POST /api/rooms/:id/host` + `x-host-key` | `set-passage`, `invite`, `remove-from-stage`, `mute`, `remove-participant`, `set-chat-muted`, `end` |
| `POST /api/token` | join token; the server decides the role from the room (host key → host, on the stage list → speaker, else listener) |

Schemas for every payload are in `src/core/room-model.ts` and `src/core/messages.ts`.

## Quick start

### 1. Create the LiveKit Cloud project (one-time, ~3 minutes)

1. Sign up at **https://cloud.livekit.io** (free "Build" plan; no credit card).
2. **Create a project** (e.g. `lingo-voice`). Any region; Cloud routes users to the nearest edge anyway.
3. In the project, open **Settings → Keys → Create key**. Copy:
   - **API Key** (looks like `APIxxxxxxxxxxxx`) → `LIVEKIT_API_KEY`
   - **API Secret** (shown once) → `LIVEKIT_API_SECRET`
4. On the project overview page copy the **WebSocket URL** (looks like `wss://lingo-voice-abc123.livekit.cloud`) → `LIVEKIT_URL`.

That is all the provider configuration this pass needs. Rooms are created automatically when the first participant joins.

### 2. Run locally

Requirements: Node 20.9+ (Node 22 recommended) and pnpm (`corepack enable`).

```bash
pnpm install
cp .env.example .env.local        # paste the three LIVEKIT_* values
pnpm dev                          # http://localhost:3000
```

Open http://localhost:3000, create a session, open the same link in a second browser window (or an incognito
window) and talk to yourself. Use headphones or you will hear echo from your own speakers.

Alternative without a cloud account (single machine only):

```bash
brew install livekit              # local LiveKit server
./scripts/dev-local.sh            # starts livekit-server --dev + next dev with matching env
```

Phones cannot join a `localhost` dev server (browsers require HTTPS for the microphone). For cross-device
testing, deploy (below) or run `vercel` for a preview URL.

### 3. Deploy (Vercel, ~5 minutes)

```bash
npm i -g vercel
vercel                            # first run: link/create the project, accept Next.js defaults
vercel env add LIVEKIT_URL        # paste wss://....livekit.cloud  (choose Production + Preview)
vercel env add LIVEKIT_API_KEY
vercel env add LIVEKIT_API_SECRET
vercel --prod
```

Or in the Vercel dashboard: **Add New → Project → import this folder/repo**, framework "Next.js" is
auto-detected, add the three environment variables under **Settings → Environment Variables**, deploy.

Check `https://<your-app>.vercel.app/api/health` → `"configured": true` and the right `serverUrlHost`.
Then open the root URL, create a session, and send the link.

Any other Node host works too: `Dockerfile` is included (`docker build -t lingo-voice .`). The app needs
HTTPS in front of it (microphone access requires a secure context).

### Where each environment variable goes

| Variable | Required | Where it lives | Notes |
|---|---|---|---|
| `LIVEKIT_URL` | yes | server only (Vercel env / `.env.local`) | returned to clients by `/api/token`, so no `NEXT_PUBLIC_` copy is needed |
| `LIVEKIT_API_KEY` | yes | server only | |
| `LIVEKIT_API_SECRET` | yes | server only | never shipped to the browser |
| `LIVEKIT_TOKEN_TTL_SECONDS` | no (7200) | server only | tokens are checked at join; clients fetch a new one when rejoining |
| `DEFAULT_PARTICIPANT_ROLE` | no (`speaker`) | server only | role when the client sends none |
| `LOG_LEVEL` | no (`info`) | server only | `debug` / `info` / `warn` / `error` |

## Using a session

- `/` → enter a name, create or type a session ID → `/s/<id>`.
- Share the URL `https://<host>/s/<id>`. Everyone with it joins the same room.
- Query parameters for testing: `?name=Alice`, `?role=listener|speaker|host`, `?autojoin=1`.
- Controls: **Join / Leave**, **Mute / Unmute**, **Enable audio** (appears only when the browser blocks playback), microphone device picker.
- The **Diagnostics** panel asks the LiveKit server to simulate failures (signal drop, full reconnect, server disconnect, node failure) so reconnection can be tested without pulling cables. Works on LiveKit Cloud too.
- `window.__lingoVoice.getSnapshot()` in the browser console dumps the full state.

## RTC architecture decision

Evaluated LiveKit Cloud, Daily and Agora against the brief (voice quality, latency, reliability, mobile web incl.
iOS Safari, native SDKs, reconnection, global infra, stage model, DX, ops, price). Short version:

| | LiveKit Cloud | Daily | Agora |
|---|---|---|---|
| Core | Open-source SFU + managed global cloud | Managed SFU | Managed, proprietary |
| Audio | Opus, DTX, RED, optional Krisp noise cancellation | Opus, good processing | Good, proprietary codecs optional |
| Reconnection | Built in: resume → full reconnect, pluggable policy, scenario simulation API | Built in | Built in |
| Web / iOS Safari / Android Chrome | First class | First class | Good, heavier SDK |
| Native SDKs | React Native, Swift, Kotlin, Flutter, Unity, Rust, Node, Python | React Native, iOS, Android | React Native, iOS, Android, more |
| Stage model (few speakers, many listeners) | Yes: per-participant publish/subscribe grants, hidden participants, Cloud handles large rooms | Yes | Yes (its origin) |
| Pricing (audio) | $0.0005/participant-min, $0.0004 at Scale, + bandwidth after included GB | $0.00099/participant-min (volume discounts to $0.00036) | $0.99 per 1,000 min ($0.59 at volume) |
| Exit path | Self-host the same open-source server, same SDKs | None | None |

**Choice: LiveKit Cloud.** It has the cleanest reconnection semantics, a shared SDK core between web and
React Native (the RN package wraps `livekit-client`, so `src/core` runs unchanged), the lowest list price, and
an open-source server as the escape hatch if economics ever demand self-hosting. Daily is a close second and
would have been fine; Agora is the most expensive and the least open.

Sources: [LiveKit pricing](https://livekit.com/pricing), [Daily pricing](https://www.daily.co/pricing),
[Agora RTC pricing](https://www.agora.io/en/pricing/agora-rtc).

## Code layout

```
src/
  core/                 platform independent (no React, no DOM, no Node APIs)
    types.ts            roles, TokenRequest/TokenResponse, API error shape
    validation.ts       zod schemas shared by server + clients; id generators
    permissions.ts      role -> {canPublish, canSubscribe}  (single source of truth)
    room-options.ts     LiveKit RoomOptions tuned for voice (AEC/NS/AGC, 32 kbps Opus, DTX, RED)
    errors.ts           user-facing recoverable error model + classifiers for SDK/browser errors
    token-client.ts     fetch-based token client (works in browsers and React Native)
    voice-session.ts    VoiceSession controller: join/leave/rejoin, mic, devices, data messages, attributes, state snapshot
    room-model.ts       product model: room metadata schema, roles, API payload schemas
    messages.ts         chat / reaction / moderation message codecs
    passages.ts         built-in reading passages (8 languages x 3 levels)
  server/               server only
    env.ts              env validation (never leaks values), health description
    token-service.ts    AccessToken minting from role permissions
    room-service.ts     rooms on LiveKit's admin API: create/list, stage, mute, remove, chat mute, end
    host-auth.ts        host key generation / hashing / verification
    logger.ts, http.ts  JSON logging, API error helpers
  app/                  Next.js routes
    page.tsx, create/   lobby and room creation
    room/[roomId]/      the live room (client-only)
    api/rooms/...       room list, create, details, host actions
    api/token/route.ts  POST -> TokenResponse (role decided server-side for product rooms)
    api/health/route.ts GET  -> config sanity
    s/, s/[sessionId]/  voice diagnostics harness
  web/
    live/               product UI: useLiveRoom hook, RoomShell, Stage, PassageCard, ChatPanel, PeopleSheet, ...
    lobby/              Lobby and CreateRoomForm
    hooks/useVoiceSession.ts   binds VoiceSession to React + online/visibility events
    components/         diagnostics UI and RemoteAudioRenderer (the only DOM audio touch point)
e2e/                    Playwright multi-client tests (real audio, local LiveKit server)
```

### Reuse from a native client later

- **Backend / token flow / room & identity model / permissions**: unchanged. A native app POSTs the same JSON to `/api/token`.
- **`src/core`**: depends only on `livekit-client`, which `@livekit/react-native` re-exports. `VoiceSession` can be
  driven from a React Native hook identical to `useVoiceSession`, swapping the browser `online`/`visibilitychange`
  listeners for `NetInfo`/`AppState`.
- **Not reused**: `src/web` (DOM audio renderer, debug UI). On React Native the SDK plays remote audio itself
  and audio-session routing is configured natively.
- **Before real users**: identity must come from authenticated users (today the client proposes one; see Security).

## Reliability: what handles what

| Situation | Handled by | Behaviour |
|---|---|---|
| Brief network loss, Wi-Fi ↔ cellular switch | LiveKit SDK | ICE restart / signal resume; UI shows `reconnecting`; audio resumes without rejoin |
| SDK gives up (long outage, server node loss, `SIGNAL_CLOSE`, `STATE_MISMATCH`, …) | `VoiceSession` | status `rejoining`; fetches a **fresh token** and joins again, 5 attempts with exponential backoff (1s → 10s), then `failed` with a **Rejoin** button |
| Device comes back online / app returns to foreground while rejoin is pending | `useVoiceSession` | triggers the pending rejoin immediately |
| Browser refresh | sessionStorage identity + `disconnectOnPageLeave` | others see a clean leave + rejoin of the same identity, never a duplicate |
| Same identity joins elsewhere (duplicated tab) | LiveKit `DUPLICATE_IDENTITY` | the older connection is closed with an explicit message and a Rejoin button; no auto-rejoin loop |
| Mic permission denied / no mic / mic busy / insecure origin | `classifyMicrophoneError` | stays connected as listener; specific message + **Retry mic**; recovery without rejoining is tested |
| Mic device unplugged / changed | LiveKit SDK + `MediaDevicesChanged` | SDK restarts the track on the default device; device list refreshes; picker to switch |
| Publish / subscribe failure | SDK events | surfaced as recoverable errors with a Rejoin action |
| Silent microphone (hardware mute, wrong device) | `LocalAudioSilenceDetected` | inline warning |
| Autoplay blocked (iOS Safari, some Chrome cases) | `AudioPlaybackStatusChanged` | prominent **Enable audio** button; one tap fixes it |
| Mobile backgrounding / screen lock | SDK + `visibilitychange` | iOS suspends capture; SDK restarts the track on return; if the connection died meanwhile, auto-rejoin runs on return |
| Leaving / closing the tab | `Room.disconnect` | tracks stopped, listeners removed, others see the leave immediately |

Audio processing uses the platform's WebRTC pipeline: echo cancellation, noise suppression, automatic gain
control (standard `getUserMedia` constraints), Opus at 32 kbps mono with DTX (silence costs almost nothing)
and RED (redundancy against packet loss; Chrome/Android, ignored by Safari). No custom DSP. LiveKit Cloud's
Krisp-based enhanced noise cancellation can be added later with one package if needed.

## Mobile web notes and known limitations

- **HTTPS is mandatory** for the microphone everywhere except `localhost`.
- **iOS Safari autoplay**: if the user did not tap the page before remote audio arrives (for example when opening
  an `?autojoin=1` link) Safari blocks playback until a gesture. The app detects this and shows **Enable audio**.
  Joining via the Join button counts as the gesture, so the normal flow needs no extra tap.
- **iOS backgrounding / screen lock**: iOS pauses microphone capture (and often playback) when Safari is not in
  the foreground. On return the SDK restarts the track automatically; if the server dropped the connection in the
  meantime (typically after 30–60 s), the app rejoins by itself. There is no way for a web page to keep talking
  while the screen is locked; a native app can (background audio mode).
- **Phone calls / other apps grabbing the mic** end the track; it restarts on return. Expect a short gap.
- **Bluetooth headsets**: iOS routes automatically and does not expose a device picker to web pages. The
  device picker is useful on desktop and Android.
- **Mic indicator while muted**: the capture stays alive while muted (instant unmute, fewer iOS re-prompts),
  so the browser's "microphone in use" indicator stays on. Change `stopMicTrackOnMute` in
  `src/core/room-options.ts` if that becomes a product problem.
- **What "muted" sends**: measured with two clients, a muted participant emits only Opus DTX keep-alives
  (about 5 tiny packets/s, under 1 kbps, pure silence) and the server forwards **nothing** of it to others
  (0 packets/s received). So the "sent" packet counter still creeps up while muted; the other side's
  "received" counter must stay flat. `e2e/mute-traffic.spec.ts` guards this. Billing still counts the
  connected minutes while muted.
- **Duplicated tabs** copy `sessionStorage` on some browsers, so the duplicate kicks the original with a clear
  message. Two *separately opened* tabs get different identities and can be used for local testing.
- **Android Chrome** keeps WebRTC alive in the background with a notification; memory pressure can still kill the
  tab, which the rejoin logic covers on return.
- **Restrictive networks** (UDP blocked): LiveKit Cloud falls back to TCP/TLS on 443 automatically. Expect
  slightly higher latency.

## Security notes

- Tokens are minted server-side with room, identity, role and publish/subscribe grants; TTL 2 h by default.
- The client *proposes* its identity (so a refresh replaces the stale connection). Until real authentication
  exists, anyone can pick any identity in a room whose link they know. This is acceptable for a link-based test
  session, not for the product: when auth lands, derive `identity` from the user id server-side and drop the
  client field. The same applies to `role`, which the client may request today for testing.
- Add rate limiting to `/api/token` before public launch (Vercel WAF or an edge middleware).
- Participants cannot publish data channels, camera or screen, or change their own metadata.

## Testing

### Automated

```bash
pnpm typecheck
pnpm test           # vitest: token grants per role, TTL, secret never leaks, env validation, route handling
pnpm test:e2e       # playwright: multi-client real-audio suite (needs `brew install livekit`, starts everything itself)
```

The e2e suite launches `livekit-server --dev` and `next dev` on port 3100, then runs Chromium contexts with a
generated speech-like test signal as the fake microphone. It asserts real RTP packets and non-zero decoded
audio energy on the receiving side, not just UI state. Scenarios: presence, publish/subscribe, active speaker,
mute propagation, signal reconnect, forced full reconnect, offline → online, server-side disconnect →
auto-rejoin with fresh token, refresh without duplicates, leave/join, listener role, permission denied → recovery,
duplicate identity, muted participants send nothing audible.

`e2e/live-room.spec.ts` drives the product with a host and a learner: create a room → it appears in the lobby →
learner joins as listener and hears the host → chat both ways → reaction → raise hand → host invites → learner
turns on the mic and the host hears them → host deletes a message, changes the passage, removes the learner
from stage, mutes their chat → host ends the room and it leaves the lobby. It also checks that host actions
without the key are rejected, that the host keeps control after a reload, and that a removed learner is told why.

If a dev server is already running in this folder (Next allows one per directory), run the suite against a
production build instead: `pnpm build && E2E_SERVER_CMD="pnpm exec next start -p 3100" pnpm test:e2e`.

### What has been verified so far (2026-10-08)

Automated, on this machine, against `livekit-server` 1.13.9 and Chromium with a generated speech-like signal
as microphone (`pnpm test` 26 unit tests, `pnpm test:e2e` 15 scenarios, all green):

| Milestone | Evidence |
|---|---|
| M1 secure tokens | grants per role verified by `TokenVerifier`; wrong secret rejected; TTL honoured; secret absent from responses; env misconfiguration returns a clean 500 |
| M2 presence | two separate browser contexts join the same session and list each other |
| M3 real audio | each side receives the other's audio: ~53 kbps per stream (32 kbps Opus + RED/RTP overhead), decoded audio energy > 0, server marks the talker as active speaker |
| M4 state | mute/unmute reflected on the other side within ~1 s; speaking indicator follows the talker; while muted the publisher sends under 1 kbps of DTX keep-alives and the other side receives 0 packets |
| M5 reliability | signal drop → resumed in ~2 s; forced full reconnect → recovered in ~4 s; offline for several seconds → recovered by the SDK on reconnect; server-side disconnect → automatic rejoin with a fresh token in ~3 s; refresh → same identity back in ~2.5 s, no duplicate; clean leave → removed immediately; killed tab → removed by the server after ~21 s |
| Roles | listener cannot publish, hears everyone |
| Mic failures | permission denied keeps the user connected as listener; **Retry mic** recovers without rejoining |
| Duplicate identity | second tab with the same identity takes over; the first shows a clear message and can take the session back with **Rejoin** |

Not yet verified (needs your devices and your LiveKit Cloud project): real iPhone Safari and Android Chrome
behaviour, separate networks, cellular, Bluetooth, backgrounding. That is Milestones 6 and 7 and the checklist below.

### Manual cross-device checklist

Use headphones on at least one side when devices are in the same room, otherwise you test echo cancellation, not
the product. Open the **Event log** while testing; it timestamps every state change.

| # | Scenario | Steps | Expect |
|---|---|---|---|
| 1 | Two desktop browsers | Chrome + Safari (or two Chrome profiles) open the same link, Join, speak | Both `connected`, 2 participants, both mics `live`, "Receiving 1/1", speaking highlight follows the talker, latency feels conversational |
| 2 | Desktop + iPhone Safari | Send link via Messages, open in Safari, Join, allow mic | iPhone joins, hears desktop; if **Enable audio** appears, one tap fixes it |
| 3 | Desktop + Android Chrome | Same via link | Same as above; Chrome shows the mic notification |
| 4 | iPhone + Android | Both on their own data plans | Same as above |
| 5 | Separate Wi-Fi networks | Devices on different networks (home vs office / hotspot) | Connects within ~2 s; quality `excellent`/`good` |
| 6 | Wi-Fi vs mobile data | One device on cellular | Works; check `rtt`/`jitter` in Audio stats |
| 7 | Mute / unmute | Tap Mute on A | B sees A `muted` within a second; unmute restores audio |
| 8 | Repeated join/leave | Leave and Join 5 times on A | B's participant list always ends at 2; no ghosts |
| 9 | Temporary network interruption | Toggle airplane mode on the phone for 5–10 s, or Diagnostics → **Signal reconnect** | `reconnecting` → `connected`; audio resumes without a Join tap |
| 10 | Long interruption | Airplane mode for ~60 s | `rejoining` with attempt counter, then `connected` when the network is back (or on returning to the tab) |
| 11 | Server-side disconnect | Diagnostics → **Server leave** | `rejoining` → `connected`; others see one leave + one join |
| 12 | Browser refresh | Reload on A | A back within seconds with the same identity; B never shows two Alices |
| 13 | Background the mobile browser | Switch apps for 10 s, then 2 min, come back; also lock the screen | Short: audio resumes immediately. Long: `rejoining` → `connected` on return. Note: muted while backgrounded on iOS |
| 14 | Microphone permission denied then recovery | Deny the prompt, then allow in site settings (iOS: aA menu → Website Settings → Microphone) and tap **Retry mic** | Stays connected and hears others while denied; mic goes `live` after retry, no rejoin |
| 15 | Bluetooth / headset | Connect AirPods / a headset mid-session; on desktop switch the picker | Audio follows the headset; event log shows `devices.changed`; no disconnect |
| 16 | Listener role | Open the link with `?role=listener` | `Listening only`, no mic published, hears everyone |
| 17 | Three or more speakers | 3–4 devices, all speaking at once | Everyone hears everyone; speaking indicators flicker per talker |

## Economics (LiveKit Cloud, list prices October 2026)

**What drives cost**: WebRTC **participant-minutes** (every connected participant, listener or speaker, pays
the same per minute while connected, talking or not) plus **downstream bandwidth** beyond the plan's included
GB (each listener downloads one audio stream per *active* speaker; DTX makes silent speakers nearly free).

| Plan | Monthly | Included participant-min | Overage / min | Included downstream | Concurrent cap |
|---|---|---|---|---|---|
| Build | $0 | 5,000 | $0.0005 | 50 GB | 100 |
| Ship | $50 | 150,000 | $0.0005 | 250 GB, then $0.12/GB | 1,000 |
| Scale | $500 | 1,500,000 | $0.0004 | 3 TB, then $0.10/GB | 5,000 |
| Enterprise | custom | custom | custom | custom | custom |

Assumptions for the scenarios: each monthly active user spends **60 min/day, 20 days/month = 1,200 participant-min**
(a heavy practice habit; halve everything for 30 min/day). Audio at 32 kbps ≈ 14 MB per listener-hour per
active speaker; typical room 2–3 speakers.

| Monthly active users | Participant-min / month | Plan + overage | Bandwidth | Approx. total | Per user |
|---|---|---|---|---|---|
| 100 | 120,000 | Ship $50 (included) | ~30–60 GB (included) | **~$50/mo** | $0.50 |
| 1,000 | 1,200,000 | Scale $500 (included) | ~0.3–0.9 TB (included) | **~$500/mo** | $0.50 |
| 10,000 | 12,000,000 | Scale $500 + 10.5M × $0.0004 = $4,700 | ~3–9 TB → up to ~$600 overage | **~$5,000–5,300/mo** | ~$0.50 |

For comparison at 1.2M min/month: Daily ≈ $1,190, Agora ≈ $700–1,190. LiveKit is the cheapest of the three at list price.

**What makes it expensive**: large passive audiences (a 500-listener room burns 500 participant-min per minute,
same as 250 two-person conversations); rooms left open with idle connected users; many simultaneous speakers per
room (bandwidth multiplies per listener); and long sessions on free tiers. Mitigations are product decisions:
idle timeouts, auto-leave after inactivity, caps on free minutes, limit concurrent speakers per room (the stage model).

**Can a paid model cover it?** At ~$0.50 per heavy user per month, a $8–15/month subscription spends 3–6 % of
revenue on RTC. Free users cost real money, so cap free usage (minutes/day) or gate voice behind a trial.

**When to look at self-hosting or enterprise pricing**: around **5–10 M participant-min/month (≈ $2.5–5 k/mo)**.
Below that, the managed service is cheaper than the engineering time. Above it, LiveKit's open-source server
on a few VMs plus TURN costs roughly $500–1,500/month in infrastructure plus on-call attention; enterprise
pricing usually becomes negotiable at the same scale. Because the SDKs and API are identical, that migration is an
infrastructure change, not a rewrite.

## API (for any client)

`POST /api/token` with JSON `{ "sessionId": "k7mq-x2pa", "displayName": "Alice", "identity": "p-...", "role": "speaker" }`
(`identity` and `role` optional) returns:

```json
{
  "serverUrl": "wss://....livekit.cloud",
  "token": "<jwt>",
  "sessionId": "k7mq-x2pa",
  "identity": "p-8fk2m3qz7t4w",
  "displayName": "Alice",
  "role": "speaker",
  "permissions": { "canPublish": true, "canSubscribe": true },
  "expiresAt": "2026-10-08T15:00:00.000Z"
}
```

Errors: `400 invalid-json | invalid-request`, `500 server-misconfigured | token-failed`, body `{ "error": { "code", "message", "details?" } }`.
`GET /api/health` returns `{ ok, livekit: { configured, serverUrlHost, issues } }`.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Join fails: "voice server is not configured" | `LIVEKIT_*` env vars missing on the server. Check `/api/health`. Redeploy after adding them on Vercel. |
| Join fails: "server rejected the join token" | API key/secret do not match the project behind `LIVEKIT_URL`. Regenerate a key in Cloud → Settings → Keys. |
| Join fails: "could not be reached" / timeout | Wrong `LIVEKIT_URL` (must be `wss://`), firewall, or the Cloud project is paused. |
| Connected, participant visible, but silent | Look at **Audio playback**: if `blocked`, tap **Enable audio**. Check **Receiving x/y** and the `energy` column in Audio stats: energy rising means audio arrives and the problem is output routing/volume (iOS silent switch does not affect it; volume buttons do). |
| "Microphone permission was denied" | Browser site permission. Chrome: lock icon → Site settings → Microphone. iOS Safari: aA → Website Settings → Microphone → Allow, or Settings → Safari → Microphone. Then **Retry mic**. |
| "Microphone access requires HTTPS" | You opened an `http://` URL that is not localhost. Use the deployed `https://` URL. |
| "Your microphone looks silent" | Wrong input device, hardware mute switch, or OS-level permission for the browser (macOS: System Settings → Privacy & Security → Microphone). |
| Echo / feedback | Two devices in the same room without headphones. Echo cancellation handles the local loop, not the acoustic path between two devices. |
| Everyone hears robotic / choppy audio | Check `lost` and `jitter` in Audio stats; usually one participant's Wi-Fi. Cellular is often better than bad Wi-Fi. |
| Participant stuck in list after they closed the tab | LiveKit removes them after its reconnect grace period (~20 s, measured 21 s locally) when the browser could not send a leave, e.g. the OS killed the tab. A normal close or Leave is instant. |
| `DUPLICATE_IDENTITY` / "joined from another tab or device" | Same identity connected twice (duplicated tab). Use the Rejoin button in the tab you want to keep. |
| Phone cannot reach `localhost:3000` | Expected. Deploy (or `vercel` preview) for cross-device testing. |
| e2e: `livekit-server: command not found` | `brew install livekit` (macOS) or see https://docs.livekit.io/home/self-hosting/local/ |

## What is deliberately not here yet

Accounts and authentication (the host key and the client-proposed identity stand in for them), persistent chat
history and room history, scheduled or recurring rooms, profiles and progress, rate limiting on the public
endpoints, recording, analytics, and push notifications. The room model is designed so these land on top
without touching the RTC layer: identity and host authority move from "host key + device identity" to
"authenticated user", everything else stays.
