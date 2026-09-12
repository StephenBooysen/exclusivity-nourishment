# Handoff: Intermittent Fasting Companion (mobile web app)

## Overview
A mobile web app for running intermittent-fasting plans: pick a strategy and schedule, run today's fast from a live dashboard (start/stop, countdown, notes), and review history (streaks, calendar, past sessions). Three screens: **Setup**, **Dashboard**, **History**.

## About the Design Files
The files in this bundle (`Fasting App.dc.html` and `reference/`) are **design references built in HTML** — interactive prototypes showing intended look, content and behavior, not production code to copy directly. `Fasting App.dc.html` is a proprietary streaming-component format (has `<x-dc>`/`sc-for`/`sc-if`/`{{ }}` template syntax) — do not try to run it as-is; treat it as documentation and open it in a browser preview only if your tooling supports it (it won't render as a normal HTML file). The task is to **recreate these screens in the target codebase's actual environment** (React Native, Flutter, native iOS/Android, or whatever stack the project uses) using its established component patterns — or, if no environment exists yet, choose the most appropriate mobile-web stack (e.g. React + a UI kit) and implement there.

## Fidelity
**High-fidelity.** Colors, type, spacing, radii and copy below are final — recreate pixel-close using the target codebase's own component/styling system, not by embedding this HTML.

## Design tokens

Palette:
- App background (screen canvas): `#f7f5f0`
- Panel/card/input background: `#ffffff`
- Primary accent (green): `#195446` — solid fills (primary buttons, active toggle, progress ring/card, avatar), tab-selected states
- Accent tints (derive from `#195446`): 100 ≈ 12% mix with white, 200 ≈ 24%, 300 ≈ 40%, 400 ≈ 60% — use for selected-card backgrounds, tag fills
- Accent shades (darker, for text-on-tint / pressed states): 600 ≈ 90% mix with black, 700 ≈ 78%, 800 ≈ 60%, 900 ≈ 45%
- Text: `#1d2422`
- Neutral/divider tones for unselected/empty states: light warm greys (`#f9f4ed`, `#eee7db`, `#dcd3c4`, `#c0b6a5`) — used e.g. for calendar "missed"/"no plan" cells
- Muted text: text color at ~55-65% opacity

Typography:
- Headings and body/UI: **Manrope** — headings at weight 800, body at 400/500/600/700 (single-family system, no separate display face)
- Screen titles ~28-30px, section labels ~13-15px semibold, kickers ~11px uppercase letter-spacing 0.1em, body ~13-14px, micro-labels ~10-11px uppercase

Radius: small controls/tags/inputs are fully pill-shaped (`border-radius: 999px`); cards and stat tiles use ~12-14px; small chips ~6-10px.

Bottom navigation: every screen has a fixed bottom tab bar (white background, hairline top divider) with four items — **Home**, **Fast**, **History**, **Settings** — icon + 10px label, active tab in the green accent (bold label), inactive tabs at ~45% text opacity. Active tab per screen: Setup → Fast, Dashboard → Home, History → History. Settings has no screen designed yet.

Shadows: soft, low-contrast card elevation (a subtle 1-3px ambient shadow), nothing harsh.

Buttons: primary = solid `#195446` fill, cream/white text, pill-shaped, darkens on press. Secondary = white fill with a thin divider-color border.

## Screens

### 1. Setup — "Set your fast"
Purpose: create/edit the active fasting plan.

Layout (top to bottom, single scrolling column):
- Kicker "New plan" + H1 "Set your fast"
- **Fasting strategy** — label, then a 2×2 grid of selectable cards, each showing a strategy name + one-line blurb:
  - 16:8 — "16h fast · 8h eating window"
  - 20:4 — "20h fast · 4h eating window"
  - OMAD 23:1 — "23h fast · 1h eating window"
  - 5:2 — "2 full fasting days / week"
  Selected card: tinted green background + green border. Unselected: white/panel background, transparent border. Single-select (tap swaps selection).
- **Fasting days** (only shown when strategy = 5:2) — 7 pill toggles, Mon…Sun, multi-select (green fill = selected). Helper text: "Pick two non-consecutive days for a full 24h fast; every other day eats normally."
- **Fast begins at** (only shown for daily strategies 16:8/20:4/23:1) — a native time picker, default 8:00 PM.
- Below it, two read-only stat tiles side by side: **Opens** and **Closes** — computed from strategy + start time (e.g. start 8:00 PM + 16h fast = eating window opens 12:00 PM next day, closes back at 8:00 PM).
- **Plan length** — segmented control, two options: "1 week" / "1 month". Single-select.
- Primary button, full width: **"Start fasting plan"** — commits settings and starts today's fast immediately, then the user is taken to the Dashboard.

### 2. Dashboard — active fast
Purpose: monitor and control today's fast in progress; log notes.

Layout:
- Header row: "Good evening" (small, muted) + user's name (heading), circular avatar with initials (green fill) at top right.
- **Progress card** (green `#195446` fill, cream text, rounded ~16-20px):
  - Small pill tag: "{strategy label} · Day {n} of {total}" (e.g. "16:8 plan · Day 12 of 30", or "5:2 · Mon & Thu · Day 12 of 30")
  - Large circular progress ring (SVG, ~180px) — cream stroke fills clockwise as % of the fasting window elapses. Center text: big bold percentage (e.g. "82%"), smaller line below: time remaining (e.g. "2h 55m to go")
  - Stage label under the ring: plain-language phase from elapsed hours — Digesting (0-4h) → Burning glycogen (4-10h) → Fat-burning (10-16h) → Deep fast (16h+). Framed as an informational estimate, not medical advice.
  - Button, pill, white fill/dark-green text: **"End fast early"** while a fast is running, or **"Start fast"** when idle. Tapping toggles the fast state; starting resets the timer and note log for a new session; ending pushes the completed session into History.
- Three stat tiles in a row: **Started** (clock time fast began), **Elapsed** (duration so far), **Eating opens** (clock time the eating window opens).
- **Notes** section: header + count ("N logged"). List of timestamped note cards (time label in green, note text below). Input row at the bottom: text field "Log how you're feeling…" + a round green icon button (plus icon) to add the note — appends a new timestamped entry, clears the field.

### 3. History — "Your history"
Purpose: review past performance.

Layout:
- Two stat cards side by side:
  - **Current streak** (green fill, flame icon) — consecutive days a fast hit its target; big number + "days"
  - **Completion, 28 days** (white/panel fill) — % of the last 28 plan-days that hit target
- **Last 4 weeks** calendar — 7-column grid (M T W T F S S header), 28 day cells, each shaded by status:
  - Completed = solid green
  - Partial = light green tint
  - Missed = neutral grey
  - No plan that day = lightest neutral
  A small legend row below explains the four shades.
- **Past fasts** list — cards, newest first, each showing: date label (e.g. "Yesterday", "2 days ago"), a strategy tag, achieved-vs-target duration line (e.g. "16h 10m of 16h target"), and the first logged note as an italic preview quote.

## Interactions & behavior
- Strategy selection on Setup is single-select and immediately changes the visible fields (time picker vs. day pills) and all downstream time/duration math.
- Time math: eating-window open/close times, dashboard countdown, and stage label all derive from (strategy, start time, elapsed time) — recompute live.
- Starting a plan (Setup) or starting/ending a fast (Dashboard) should update shared app state immediately (no page reload) — Setup's plan feeds the Dashboard.
- Progress ring and elapsed/remaining labels update continuously while a fast is active (tick at least once a minute in production; the prototype speeds this up for demo purposes only — don't carry that over).
- Adding a note requires non-empty text; timestamps the entry with the current clock time in 12-hour format (e.g. "2:15 PM").
- Ending a fast early should still log it to History with whatever duration was achieved vs. the target.
- All screens use 12-hour time format throughout (e.g. "8:00 PM", not "20:00").

## State management
Suggested state shape:
- `plan`: { strategy: '16:8'|'20:4'|'23:1'|'5:2', startTime: 'HH:MM', fastingDays: {Mon..Sun: bool}, planLength: '1 week'|'1 month', planStartedAt: timestamp }
- `activeFast`: { active: bool, startedAt: timestamp, notes: [{ id, label, text }] }
- `history`: { calendarDays: [{ date, status: 'done'|'partial'|'miss'|'none' }], pastFasts: [{ date, strategy, achievedMs, targetMs, note }] }
- Derived/computed (not stored): elapsed time, % complete, remaining time, stage label, streak count, completion rate — all computed from the above on each render/tick.

## Assets
No photography or custom icons required beyond standard outline icons (plus/add, flame, checkmark, chevron) — use the target codebase's existing icon set at a similar rounded/bold stroke weight. No external images.

## Files
- `Fasting App.dc.html` — the full interactive prototype (all three screens, live state, all copy) — the source of truth for content and behavior. Not runnable outside its authoring tool; read it as a spec.
- `reference/ios-frame.jsx` — the iOS device-bezel frame used only to preview the screens at phone scale; not needed in the target app.
- `reference/organic-styles.css`, `reference/organic-readme.md` — the base "Organic" design system this app's tokens started from (warm cream/rounded style). This app then overrides its accent to green `#195446`, background to `#f7f5f0`, panels to `#ffffff`, and tightens the corner radii as documented above — treat those overrides as final for this app, and the rest of the Organic system (spacing scale, shadow tuning, font pairing) as the base to keep.
