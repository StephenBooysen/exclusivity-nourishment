/**
 * Browser-side mirror of `backend/services/strategies.js`. The frontend has no
 * build step and can't require server code, so the strategy table and the
 * clock/duration math live in both places — keep them in step.
 *
 * Every label the Dashboard shows while a fast runs (elapsed, remaining,
 * percentage, stage) is derived here on each tick from `startedAt` + `targetMs`;
 * none of it is stored or polled.
 */

export const STRATEGIES = {
  '16:8': { key: '16:8', label: '16:8', hours: 16, blurb: '16h fast · 8h eating window' },
  '20:4': { key: '20:4', label: '20:4', hours: 20, blurb: '20h fast · 4h eating window' },
  '23:1': { key: '23:1', label: 'OMAD 23:1', hours: 23, blurb: '23h fast · 1h eating window' },
  '5:2': { key: '5:2', label: '5:2', hours: 24, blurb: '2 full fasting days / week' }
};

export const DAY_KEYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const PLAN_LENGTHS = ['1 week', '1 month'];
export const HOUR_MS = 60 * 60 * 1000;

/** Elapsed-hours thresholds for the stage label. Informational estimate, not medical guidance. */
const STAGES = [
  { fromHours: 16, label: 'Deep fast' },
  { fromHours: 10, label: 'Fat-burning' },
  { fromHours: 4, label: 'Burning glycogen' },
  { fromHours: 0, label: 'Digesting' }
];

function pad(n) {
  return String(n).padStart(2, '0');
}

export function strategyFor(key) {
  return STRATEGIES[key] || STRATEGIES['16:8'];
}

export function targetMsFor(key) {
  return strategyFor(key).hours * HOUR_MS;
}

/** 'HH:MM' (what <input type="time"> gives us) → minutes past midnight. */
export function parseTime(value) {
  const [h, m] = String(value || '00:00').split(':').map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

/** Minutes past midnight → '8:00 PM'. Every clock time in this app is 12-hour. */
export function minutesToLabel12(mins) {
  const wrapped = ((Math.round(mins) % 1440) + 1440) % 1440;
  let hour = Math.floor(wrapped / 60);
  const minute = wrapped % 60;
  const suffix = hour >= 12 ? 'PM' : 'AM';
  hour %= 12;
  if (hour === 0) hour = 12;
  return `${hour}:${pad(minute)} ${suffix}`;
}

export function dateToLabel12(value) {
  const date = value instanceof Date ? value : new Date(value);
  return minutesToLabel12(date.getHours() * 60 + date.getMinutes());
}

/** Local (not UTC) calendar date as 'YYYY-MM-DD' — the value an <input type="date"> wants. */
export function toDateIso(value) {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function dateFromIso(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/**
 * The Setup screen's start picker — a date ('YYYY-MM-DD') plus a time ('HH:MM')
 * — resolved into one moment. Local, not UTC, so '2026-08-02' + '14:00' means
 * 2pm as the user reads it.
 */
export function combineDateTime(dateIso, time) {
  const date = dateFromIso(dateIso);
  const mins = parseTime(time);
  date.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
  return date;
}

/** 'today' / 'tomorrow' / 'Sat 9 Aug' — how a scheduled start is announced. */
export function relativeDateLabel(value, now = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const days = Math.round((dateFromIso(toDateIso(date)) - dateFromIso(toDateIso(now))) / (24 * HOUR_MS));
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === -1) return 'yesterday';
  return date.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** Duration → '16h 10m'. Minutes are zero-padded so a ticking clock doesn't jump about. */
export function msToHM(ms) {
  const totalMinutes = Math.max(0, Math.round(ms / 60000));
  return `${Math.floor(totalMinutes / 60)}h ${pad(totalMinutes % 60)}m`;
}

export function stageFor(elapsedMs) {
  const hours = Math.max(0, elapsedMs) / HOUR_MS;
  return STAGES.find((stage) => hours >= stage.fromHours).label;
}

/** The eating window implied by (strategy, start time): opens when the fast is up, closes when the next one begins. */
export function eatingWindow({ strategy, startTime }) {
  const startMins = parseTime(startTime);
  return {
    opensLabel: minutesToLabel12(startMins + strategyFor(strategy).hours * 60),
    closesLabel: minutesToLabel12(startMins)
  };
}

/**
 * Everything the progress card renders, recomputed from the running session.
 *
 * A session whose `startedAt` is still in the future is *scheduled*, not
 * running: the ring stays empty and counts down to the start instead of
 * through the fast, because nothing has elapsed yet.
 *
 * @param {?{startedAt:string, targetMs:number}} activeFast
 * @param {number} fallbackTargetMs Target to preview against while idle.
 */
export function fastProgress(activeFast, fallbackTargetMs, now = Date.now()) {
  const targetMs = (activeFast && activeFast.targetMs) || fallbackTargetMs || 0;
  const startsAt = activeFast ? new Date(activeFast.startedAt).getTime() : 0;
  const pendingMs = activeFast ? Math.max(0, startsAt - now) : 0;

  if (pendingMs > 0) {
    return {
      active: true,
      scheduled: true,
      pendingMs,
      elapsedMs: 0,
      remainingMs: targetMs,
      targetMs,
      percent: 0,
      elapsedLabel: '0h 00m',
      // The ring's big number counts down to the start rather than showing a
      // dead 0% — that countdown is the only number moving until the fast begins.
      remainingLabel: 'until it starts',
      percentLabel: msToHM(pendingMs),
      ringLabel: `Fast starts in ${msToHM(pendingMs)}`,
      stageLabel: `Begins ${relativeDateLabel(startsAt, new Date(now))} at ${dateToLabel12(startsAt)}`
    };
  }

  const elapsedMs = activeFast ? Math.max(0, now - startsAt) : 0;
  const remainingMs = Math.max(0, targetMs - elapsedMs);
  const percent = targetMs ? Math.min(100, Math.round((elapsedMs / targetMs) * 100)) : 0;

  return {
    active: Boolean(activeFast),
    scheduled: false,
    pendingMs: 0,
    elapsedMs,
    remainingMs,
    targetMs,
    percent,
    elapsedLabel: msToHM(elapsedMs),
    remainingLabel: `${msToHM(remainingMs)} to go`,
    percentLabel: `${percent}%`,
    ringLabel: `${percent}% of the fasting window elapsed`,
    stageLabel: stageFor(elapsedMs)
  };
}
