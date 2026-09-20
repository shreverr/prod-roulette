# Prod Roulette — web

Pixel-art desktop OS that happens to be a game about deploying to production.
Next.js app, Hono API, engine in TypeScript.

```
npm install
npm run dev      # http://localhost:3000
npm test         # engine + view + token tests
npm run build
```

## How it fits together

```
browser  ──POST /api/action { token, action }──>  Hono  ──>  engine  ──>  view + events
         <──────────  { view, events, token }  ──────────
```

**The client never holds game state.** Hidden information is the whole game, so the browser
only receives `project(state)` — past slots resolved, future slots `"unknown"` unless a tool
uncovered them, and the current deployment carrying only the signals you paid for. The full
state travels as an opaque AES-GCM token (`lib/engine/seal.ts`): the player holds the blob,
the server holds the key. No database.

**Signals are generated backwards.** The hidden outcome is decided first, by shuffling exact
counts, and only then is every visible field sampled *conditioned* on it (`bake` for the paid
signals, `dress` for the free ones). A danger score never decides the outcome — otherwise the
announced count ("4 of 8 will take prod down") would stop being exactly true, and that promise is
the whole game. How readable the result is comes down to one knob, `SIGNAL_STRENGTH`, calibrated
to ~70% and asserted in the suite.

**Events drive the animation.** Every action returns an ordered `events[]` that the client
replays with delays, firing sound as it goes — which is also what hides the round-trip inside
the 1.2s deploy animation.

| file | what |
|---|---|
| `lib/engine/engine.ts` | ported 1:1 from `../prod_roulette/engine.py`, same numbers |
| `lib/engine/view.ts` | the hidden-information gate — the only thing that decides what leaks |
| `lib/engine/calibrate.ts` | Monte Carlo harness that tunes how readable a deployment is |
| `lib/engine/seal.ts` | AES-GCM state token, replaces a session table |
| `app/api/[[...route]]/route.ts` | Hono, mounted inside Next as a catch-all handler |
| `lib/sfx.ts` | every sound synthesized with WebAudio, zero audio files |
| `lib/engine/content.ts` | all flavor text, plus the danger ratings that make it readable |
| `components/pixel/` | sprites are character grids in source, painted to canvas |
| `components/os/` | menu bar, dock, draggable windows, system alerts |

Fonts are Silkscreen (chrome) and VT323 (readouts), self-hosted by `next/font`.

## Config

`GAME_SECRET` — any string, used to derive the token key. Falls back to a known dev key, so
set it in production or old tokens survive a redeploy for anyone who has the dev key.

## Not built yet

No login, leaderboard, save/resume, or daily seeded run. A finished run copies a shareable
result block to the clipboard, but nothing is recorded server-side. The engine is already
server-authoritative and the token is a clean seam: swap `seal`/`unseal` for a Durable Object
and the leaderboard becomes trustworthy without touching game code.
