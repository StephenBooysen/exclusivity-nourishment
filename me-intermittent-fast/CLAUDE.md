# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Me Intermittent Fast — a single-user intermittent-fasting companion (pick a strategy, run today's fast from a live dashboard, review streaks and history). See `.docs/design/README.md` for the design handoff the frontend was built against — that document is the source of truth for copy, layout and behaviour.

It is one of a suite of apps that share a stack and a look with `me-money-manager` (a local sibling checkout). Structure, service wiring and stylesheet all mirror that repo deliberately; when in doubt, do it the way me-money-manager does it. There is no multi-user support and none is planned.

## Commands

```
npm install
npm run dev     # nodemon ./index.js — auto-restarts on backend file changes; serves on PORT (default 9301)
npm run kill    # scripts/kill-port.js — force-kills whatever is listening on port 9301
```

There is no test suite (`npm test` is a stub that exits 1) and no lint/build step — the frontend is plain ES modules served as-is, no bundler.

`me-platform-core` is a **local sibling dependency** (`"../me-platform-core/"` in package.json) — that repo must be checked out next to this one for `npm install` to resolve. Note its own package.json still declares the older name `digital-technologies-core`; require it by the dependency key (`me-platform-core`). Its entry point exports an already-constructed `ServiceRegistry` **instance**, so `require('me-platform-core')` *is* the registry — don't reach for a `.serviceRegistry` property.

## Architecture

### Backend shape
`index.js` → `backend/app.js#createApp()` wires everything:
- `backend/services/platform.js` initializes the `me-platform-core` service registry once per process, exposing `logger`, `cache`, `dataService` (file-backed), `queue`, and `scheduler`.
- `backend/services/store.js` is a thin CRUD wrapper (`list/get/create/update/remove`) over the raw `dataService` — every domain service takes this `store` rather than talking to `dataService` directly.
- `backend/services/cacheVersion.js` implements a generation-counter cache: any write calls `versionedCache.bump()`, and expensive computations call `versionedCache.remember(key, compute)` which keys itself off the current version — no pattern-delete needed, a bump just orphans the previous generation.
- Each domain has a paired `backend/services/<x>Service.js` (business logic) + `backend/routes/<x>.js` (thin Express handlers), instantiated in `app.js` and wired together in `backend/routes/index.js`.

### Data storage — read this before touching persistence
Everything lives as JSON under `.application/data/`. One "container" = one `.json` file holding a plain object keyed by uuid (id is duplicated onto the record itself).

**No locking, no partial writes.** Every read/write is a whole-file read → modify → write of the entire container. Two `store.update()`/`store.create()` calls against the *same* container must never run concurrently (e.g. `Promise.all([...])`) — the second write's stale in-memory read silently clobbers the first's change. Sequence same-container writes with plain `await` (see `drainOnce()` in `backend/services/activityService.js`).

Containers:
- `fasting_plan` — exactly one record: `strategy`, `startTime` ('HH:MM', 24h), `fastingDays` (5:2 only), `planLength`, `planStartedAt`. Nothing derived is stored — in particular the Setup screen's **start date is not a field**: it exists only to build `planStartedAt` (via `resolveStart()` in `planService.js`), which is the single moment everything else counts days from.
- `fasts` — one record per session: `startedAt`, `endedAt`, `achievedMs`, `status` (`active`/`completed`), an inline `notes` array, plus a **snapshot** of the `strategy` and `targetMs` it was started under. That snapshot is the point: editing the plan later must never rewrite what history says was achieved. At most one record is `active` at a time.
- `app_settings` — profile and reminder toggles.
- `activity_log` — write-behind audit trail drained off a queue.
- `streak_snapshots` — dated streak/completion rows written by the scheduled job, so progress survives past the rolling 28-day window.

### Where the fasting maths lives
`backend/services/strategies.js` holds the strategy table (hours per strategy) and every clock/duration/label helper; `public/js/fasting.js` is its browser-side mirror. The frontend has no build step and cannot require server code, so **the two must be changed together** — especially the strategy hours and the stage thresholds (Digesting → Burning glycogen → Fat-burning → Deep fast).

Derived values (elapsed, % complete, remaining, stage, streak, completion rate) are never persisted. The Dashboard recomputes them locally from `activeFast.startedAt` + `targetMs` on a one-second ticker (`public/js/views/home.js`), so a running fast never polls the server. History's numbers are computed server-side in `historyService.js` and cached per data-version *and* per calendar day (the window rolls at midnight with no write to bump the version).

`historyService.js` exports its calendar/streak/completion computations as pure functions because `backend/jobs/dailyStreak.js` runs them in a worker thread straight off the file provider — worker threads get their own module registry and can't see the wired app.

### Scheduled vs running fasts
`startedAt` is the moment a fast *begins*, which need not be the moment its record was written. The Setup screen takes a start date **and** time, so an `active` record whose `startedAt` is still in the future is **scheduled**, not running — `fastsService.isScheduled()` is the single test, mirrored in the frontend by `fastProgress().scheduled`. A scheduled fast shows an empty ring counting down to its start, refuses notes, and offers "Cancel fast" instead of "End fast early".

Cancelling is a `store.remove()`, deliberately **not** an `end()`: a session with zero elapsed time would land in History as a partial day and break the streak, when in truth it never happened. `start()` applies the same rule when replacing an existing session — it cancels a scheduled one but ends a running one. A start date in the past is legitimate and backdates a fast already under way.

Calendar cell precedence: a logged session always wins (`done` if it reached its target, `partial` otherwise), then a plan day with no session is a `miss`, everything else is `none`. Today stays `none` until a fast is actually completed, so a fast still running never reads as a miss or breaks the streak.

### Frontend shape
No build step, no framework — plain ES modules loaded directly by the browser.
- `public/js/router.js` is a hash router (`#/<route>`) mapping to a `renderX(root)` function per view in `public/js/views/*.js`. Routes are `home` (dashboard), `fast` (plan setup), `history`, `settings`.
- Views are plain async functions: fetch data via `public/js/api.js`, render raw template-string HTML into the DOM, then imperatively attach event listeners. No virtual DOM — every state change re-renders by calling the view's local `draw()` again. The Dashboard's ticker is the one exception: it patches text nodes in place, and cancels itself once its card leaves the DOM.
- Anything user-entered (notes, profile name) must go through `escapeHtml()` from `public/js/format.js` before it lands in a template string.
- `public/styles.css` is me-money-manager's stylesheet kept deliberately identical down to the token values, with this app's own components (strategy cards, progress ring, fasting calendar) appended below a divider and built from the same tokens. Don't introduce new colours here — if the suite needs one, add it in me-money-manager first.

## Docs worth reading before larger features
- `.docs/design/README.md` — the design handoff: tokens, screens, copy, interaction rules.
- `.docs/design/Fasting App.dc.html` — the interactive prototype the handoff describes (a proprietary format; read it as a spec, don't run it).
