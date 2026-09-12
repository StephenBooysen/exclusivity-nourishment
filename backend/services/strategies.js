'use strict';

/**
 * The fasting strategy table plus every piece of clock/duration math the app
 * derives from it. Nothing here touches storage — a plan record only ever
 * stores (strategy, startTime, fastingDays, planLength, planStartedAt) and
 * every window, label, stage and day number is recomputed from those.
 *
 * `public/js/fasting.js` is the browser-side mirror of this module (the
 * frontend has no build step, so it cannot require server code); keep the two
 * in step when changing the strategy table or the stage thresholds.
 */

const STRATEGIES = {
  '16:8': { key: '16:8', label: '16:8', hours: 16, blurb: '16h fast · 8h eating window' },
  '20:4': { key: '20:4', label: '20:4', hours: 20, blurb: '20h fast · 4h eating window' },
  '23:1': { key: '23:1', label: 'OMAD 23:1', hours: 23, blurb: '23h fast · 1h eating window' },
  '5:2': { key: '5:2', label: '5:2', hours: 24, blurb: '2 full fasting days / week' }
};

const DAY_KEYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const PLAN_LENGTHS = { '1 week': 7, '1 month': 30 };
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Elapsed-hours thresholds for the plain-language stage label. Informational estimate, not medical guidance. */
const STAGES = [
  { fromHours: 16, label: 'Deep fast' },
  { fromHours: 10, label: 'Fat-burning' },
  { fromHours: 4, label: 'Burning glycogen' },
  { fromHours: 0, label: 'Digesting' }
];

function pad(n) {
  return String(n).padStart(2, '0');
}

/** Falls back to the default strategy rather than throwing, so a stale stored key can never break a render. */
function strategyFor(key) {
  return STRATEGIES[key] || STRATEGIES['16:8'];
}

function targetMsFor(key) {
  return strategyFor(key).hours * HOUR_MS;
}

function totalDaysFor(planLength) {
  return PLAN_LENGTHS[planLength] || PLAN_LENGTHS['1 month'];
}

/** 'HH:MM' (24h, the value an <input type="time"> produces) → minutes past midnight. */
function parseTime(value) {
  const [h, m] = String(value || '00:00').split(':').map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

/** Minutes past midnight → '8:00 PM'. Every clock time in this app is 12-hour. */
function minutesToLabel12(mins) {
  const wrapped = ((Math.round(mins) % 1440) + 1440) % 1440;
  let hour = Math.floor(wrapped / 60);
  const minute = wrapped % 60;
  const suffix = hour >= 12 ? 'PM' : 'AM';
  hour %= 12;
  if (hour === 0) hour = 12;
  return `${hour}:${pad(minute)} ${suffix}`;
}

function dateToLabel12(value) {
  const date = value instanceof Date ? value : new Date(value);
  return minutesToLabel12(date.getHours() * 60 + date.getMinutes());
}

/** Duration → '16h 10m'. Minutes are zero-padded so stacked durations line up. */
function msToHM(ms) {
  const totalMinutes = Math.max(0, Math.round(ms / 60000));
  return `${Math.floor(totalMinutes / 60)}h ${pad(totalMinutes % 60)}m`;
}

function stageFor(elapsedMs) {
  const hours = Math.max(0, elapsedMs) / HOUR_MS;
  return STAGES.find((stage) => hours >= stage.fromHours).label;
}

/** Local (not UTC) calendar date as 'YYYY-MM-DD' — a fast started at 8pm SAST belongs to that evening's date. */
function toDateIso(value) {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function dateFromIso(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/**
 * The Setup screen's start picker — a date ('YYYY-MM-DD') plus a time ('HH:MM')
 * — resolved into one moment. Local, not UTC: this is a single-user app whose
 * browser and server share a clock, and every other date helper here is local
 * too, so '2026-08-02' + '14:00' means 2pm as the user reads it.
 */
function combineDateTime(dateIso, time) {
  const date = dateFromIso(dateIso);
  const mins = parseTime(time);
  date.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
  return date;
}

/** Mon=0 … Sun=6, matching DAY_KEYS and the History calendar's column order. */
function dayKeyFor(date) {
  return DAY_KEYS[(date.getDay() + 6) % 7];
}

/** Whole days between two calendar dates, ignoring clock time. */
function daysBetween(fromIso, toIso) {
  return Math.round((dateFromIso(toIso) - dateFromIso(fromIso)) / DAY_MS);
}

/**
 * Whether the plan expects a fast on this date: inside the plan's run, and —
 * for 5:2 — one of the chosen fasting weekdays. Daily strategies fast every day.
 */
function isPlanDay(plan, dateIso) {
  if (!plan || !plan.planStartedAt) return false;
  const startIso = toDateIso(plan.planStartedAt);
  const offset = daysBetween(startIso, dateIso);
  if (offset < 0 || offset >= totalDaysFor(plan.planLength)) return false;
  if (plan.strategy !== '5:2') return true;
  return Boolean((plan.fastingDays || {})[dayKeyFor(dateFromIso(dateIso))]);
}

/** 'Day n of total' for the dashboard tag — clamped to the plan length, 1-based. */
function planDayNumber(plan, now = new Date()) {
  if (!plan || !plan.planStartedAt) return 0;
  const total = totalDaysFor(plan.planLength);
  const offset = daysBetween(toDateIso(plan.planStartedAt), toDateIso(now));
  return Math.min(total, Math.max(1, offset + 1));
}

/**
 * The eating window implied by (strategy, startTime): it opens once the
 * fasting hours are up and closes when the next fast begins.
 */
function eatingWindow(plan) {
  const startMins = parseTime(plan.startTime);
  const strategy = strategyFor(plan.strategy);
  return {
    opensLabel: minutesToLabel12(startMins + strategy.hours * 60),
    closesLabel: minutesToLabel12(startMins)
  };
}

/** '16:8 plan · Day 12 of 30', or '5:2 · Mon & Thu · Day 12 of 30' for the two-day-a-week strategy. */
function planTagLabel(plan, now = new Date()) {
  const strategy = strategyFor(plan.strategy);
  const total = totalDaysFor(plan.planLength);
  const days = DAY_KEYS.filter((day) => (plan.fastingDays || {})[day]);
  const prefix = plan.strategy === '5:2'
    ? `5:2 · ${days.join(' & ') || 'no days picked'}`
    : `${strategy.label} plan`;
  return plan.planStartedAt ? `${prefix} · Day ${planDayNumber(plan, now)} of ${total}` : prefix;
}

module.exports = {
  STRATEGIES,
  DAY_KEYS,
  PLAN_LENGTHS,
  STAGES,
  HOUR_MS,
  DAY_MS,
  strategyFor,
  targetMsFor,
  totalDaysFor,
  parseTime,
  minutesToLabel12,
  dateToLabel12,
  msToHM,
  stageFor,
  toDateIso,
  dateFromIso,
  combineDateTime,
  dayKeyFor,
  daysBetween,
  isPlanDay,
  planDayNumber,
  eatingWindow,
  planTagLabel
};
