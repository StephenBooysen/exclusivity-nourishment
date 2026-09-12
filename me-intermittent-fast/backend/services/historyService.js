'use strict';

const config = require('../config');
const {
  HOUR_MS,
  DAY_MS,
  strategyFor,
  msToHM,
  toDateIso,
  dateFromIso,
  daysBetween,
  isPlanDay
} = require('./strategies');

const CALENDAR_DAYS = config.defaults.calendarDays;

/**
 * The four-week window the History screen draws. It always ends on the Sunday
 * of the current week so the 28 cells line up under the M-T-W-T-F-S-S header,
 * which means the last row can run a few days into the future.
 */
function calendarWindow(today = new Date()) {
  const mondayIndex = (today.getDay() + 6) % 7;
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + (6 - mondayIndex));
  const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - (CALENDAR_DAYS - 1));
  return { start, end };
}

/**
 * One cell per day, shaded by outcome:
 *   done    — a session that day reached its target
 *   partial — a session that day fell short
 *   miss    — the plan expected a fast and none was logged
 *   none    — no plan that day, or the day hasn't been judged yet
 *
 * A session always wins over the plan window, so sessions logged before the
 * current plan started still show up rather than reading as "no plan".
 * A day stays `none` until its fast is actually completed — neither today nor
 * the day a still-running fast began (an overnight fast belongs to yesterday)
 * may read as a miss, or a fast in progress would break its own streak.
 *
 * Pure function: the scheduled job (jobs/dailyStreak.js) runs it in a worker
 * thread straight off the file provider, with no app wiring available.
 */
function computeCalendar(fasts, plan, { today = new Date() } = {}) {
  const { start } = calendarWindow(today);
  const todayIso = toDateIso(today);

  const byDate = new Map();
  const unjudged = new Set([todayIso]);
  for (const fast of fasts) {
    const dateIso = fast.date || toDateIso(fast.startedAt);
    if (fast.status !== 'completed') {
      unjudged.add(dateIso);
      continue;
    }
    // Several fasts can share a day (start → end early → start again); the best result represents the day.
    const existing = byDate.get(dateIso);
    if (!existing || (fast.achievedMs || 0) > (existing.achievedMs || 0)) byDate.set(dateIso, fast);
  }

  const cells = [];
  for (let i = 0; i < CALENDAR_DAYS; i += 1) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const dateIso = toDateIso(date);
    const fast = byDate.get(dateIso);

    let status = 'none';
    if (fast) {
      status = (fast.achievedMs || 0) >= (fast.targetMs || 0) ? 'done' : 'partial';
    } else if (!unjudged.has(dateIso) && dateIso < todayIso && isPlanDay(plan, dateIso)) {
      status = 'miss';
    }

    cells.push({
      date: dateIso,
      status,
      achievedMs: fast ? fast.achievedMs || 0 : 0,
      targetMs: fast ? fast.targetMs || 0 : 0,
      isToday: dateIso === todayIso
    });
  }
  return cells;
}

/** Consecutive on-target days ending now; unjudged days (`none`) are skipped, anything else stops the count. */
function computeStreak(cells) {
  let streak = 0;
  for (let i = cells.length - 1; i >= 0; i -= 1) {
    const status = cells[i].status;
    if (status === 'none') continue;
    if (status !== 'done') break;
    streak += 1;
  }
  return streak;
}

/** Share of the judged days in the window that hit target. */
function computeCompletion(cells) {
  const scored = cells.filter((cell) => cell.status !== 'none');
  if (scored.length === 0) return 0;
  return Math.round((scored.filter((cell) => cell.status === 'done').length / scored.length) * 100);
}

function relativeDayLabel(dateIso, today = new Date()) {
  const diff = daysBetween(dateIso, toDateIso(today));
  if (diff <= 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return `${diff} days ago`;
  return dateFromIso(dateIso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
}

function createHistoryService({ fasts, plan, versionedCache }) {
  async function pastFasts(limit = 20, today = new Date()) {
    const done = await fasts.completed(limit);
    return done.map((fast) => ({
      id: fast.id,
      date: fast.date || toDateIso(fast.startedAt),
      dateLabel: relativeDayLabel(fast.date || toDateIso(fast.startedAt), today),
      strategyLabel: strategyFor(fast.strategy).label,
      achievedMs: fast.achievedMs || 0,
      targetMs: fast.targetMs || 0,
      achievedLabel: `${msToHM(fast.achievedMs || 0)} of ${Math.round((fast.targetMs || 0) / HOUR_MS)}h target`,
      note: (fast.notes || []).length ? fast.notes[0].text : ''
    }));
  }

  /**
   * Cached per data-version *and* per calendar day: nothing about this changes
   * without a write, except the window itself rolling over at midnight.
   */
  async function get() {
    const today = new Date();
    return versionedCache.remember(`history:${toDateIso(today)}`, async () => {
      const [all, currentPlan] = await Promise.all([fasts.list(), plan.get()]);
      const calendarDays = computeCalendar(all, currentPlan, { today });
      return {
        streak: computeStreak(calendarDays),
        completionRate: computeCompletion(calendarDays),
        calendarDays,
        pastFasts: await pastFasts(20, today),
        windowDays: CALENDAR_DAYS,
        generatedAt: today.toISOString()
      };
    });
  }

  return { get, pastFasts };
}

module.exports = {
  createHistoryService,
  computeCalendar,
  computeStreak,
  computeCompletion,
  calendarWindow,
  relativeDayLabel,
  CALENDAR_DAYS,
  DAY_MS
};
