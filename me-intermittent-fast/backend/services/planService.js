'use strict';

const config = require('../config');
const { STRATEGIES, DAY_KEYS, PLAN_LENGTHS, combineDateTime, toDateIso } = require('./strategies');

const CONTAINER = 'fasting_plan';

/**
 * Single-user app: there is exactly one plan record, held in its own
 * container the same way `app_settings` holds the one settings record.
 */
const DEFAULTS = {
  strategy: config.defaults.strategy,
  startTime: config.defaults.startTime,
  fastingDays: { ...config.defaults.fastingDays },
  planLength: config.defaults.planLength,
  planStartedAt: null
};

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/**
 * The Setup screen's start picker → the moment the plan (and its first fast)
 * begins. `startDate` is not a stored plan field — it only exists to build
 * `planStartedAt`, which is what everything else derives days from.
 *
 * Omitting it means "now", which is what "Start fasting plan" did before the
 * date picker existed. A date in the past is allowed on purpose: it backdates
 * a fast already under way.
 */
function resolveStart(startDate, startTime) {
  if (startDate === undefined || startDate === null || startDate === '') return new Date();
  if (!DATE_PATTERN.test(startDate)) throw new Error('Start date must be YYYY-MM-DD');
  const resolved = combineDateTime(startDate, startTime);
  // The pattern accepts '2026-02-31'; the Date constructor silently rolls it
  // into March, so round-trip it to reject days that don't exist in that month.
  if (toDateIso(resolved) !== startDate) throw new Error(`Not a real date: ${startDate}`);
  return resolved;
}

/**
 * Whitelists and validates an incoming patch. Anything the client didn't send
 * is left untouched, so a partial PUT (e.g. only `strategy`) is safe.
 */
function sanitize(patch = {}) {
  const clean = {};

  if (patch.strategy !== undefined) {
    if (!STRATEGIES[patch.strategy]) throw new Error(`Unknown strategy: ${patch.strategy}`);
    clean.strategy = patch.strategy;
  }

  if (patch.startTime !== undefined) {
    if (!TIME_PATTERN.test(patch.startTime)) throw new Error('Start time must be 24-hour HH:MM');
    clean.startTime = patch.startTime;
  }

  if (patch.planLength !== undefined) {
    if (!PLAN_LENGTHS[patch.planLength]) throw new Error(`Unknown plan length: ${patch.planLength}`);
    clean.planLength = patch.planLength;
  }

  if (patch.fastingDays !== undefined) {
    const days = {};
    for (const key of DAY_KEYS) days[key] = Boolean(patch.fastingDays[key]);
    clean.fastingDays = days;
  }

  return clean;
}

function createPlanService({ store, versionedCache, activity }) {
  async function get() {
    const all = await store.list(CONTAINER);
    if (all.length > 0) return all[0];
    return store.create(CONTAINER, DEFAULTS);
  }

  async function update(patch) {
    const current = await get();
    const updated = await store.update(CONTAINER, current.id, sanitize(patch));
    await versionedCache.bump();
    return updated;
  }

  /**
   * Commits the setup screen's choices and (re)starts the plan clock from the
   * picked start date and time — "Day 1 of N". Starting the first fast is the
   * caller's job (routes/plan.js) so the two writes stay ordered and visible;
   * it reads the moment back off `planStartedAt` so plan and fast can't drift.
   */
  async function start(patch) {
    const current = await get();
    const clean = sanitize(patch);
    const beginsAt = resolveStart(patch && patch.startDate, clean.startTime || current.startTime);
    const updated = await store.update(CONTAINER, current.id, {
      ...clean,
      planStartedAt: beginsAt.toISOString()
    });
    await versionedCache.bump();
    await activity.log('plan', `Started a ${updated.strategy} plan for ${updated.planLength}`, {
      strategy: updated.strategy,
      planLength: updated.planLength,
      planStartedAt: updated.planStartedAt
    });
    return updated;
  }

  return { get, update, start, DEFAULTS };
}

module.exports = { createPlanService, CONTAINER, DEFAULTS, sanitize, resolveStart };
