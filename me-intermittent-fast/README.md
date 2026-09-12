# me-intermittent-fast

An intermittent fasting companion: pick a strategy and schedule, run today's fast from a live dashboard, and review streaks and history. Part of the same suite as [me-money-manager](../me-money-manager) — same stack, same design system.

## Running it

```
npm install
npm run dev
```

Then open http://localhost:9301 (or `PORT=xxxx npm run dev` to pick a different port). `npm run kill` force-frees the port if a previous run is still holding it.

`me-platform-core` is a local sibling dependency (`../me-platform-core/`), so that repo must be checked out next to this one for `npm install` to resolve.

## Screens

- **Home** — today's fast: progress ring, stage label, start/end, and a timestamped note log.
- **Fast** — set the plan: strategy (16:8 / 20:4 / OMAD 23:1 / 5:2), fasting days (5:2), the date and time the fast begins, plan length. A start still to come schedules the fast; one already past backdates a fast under way.
- **History** — current streak, 28-day completion rate, four-week calendar, and past sessions.
- **Settings** — profile, a read-only summary of the current plan, and reminder toggles.

## Structure

- `index.js` — process entry point, starts the Express app on `PORT` (default 9301)
- `backend/` — Express app, routes, and services; JSON-file storage via `me-platform-core` (`../me-platform-core`), with caching, a queue-backed activity log, and a scheduled daily streak-snapshot job wired through the same platform
- `public/` — the mobile web frontend: plain HTML/CSS/JS (ES modules), no build step, no framework
- `.docs/design/` — the visual design handoff this app's frontend was built against

Stage labels ("Fat-burning", "Deep fast") and eating-window times are informational estimates derived from elapsed hours, not medical advice.
