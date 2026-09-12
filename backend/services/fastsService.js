'use strict';

const crypto = require('node:crypto');
const { strategyFor, targetMsFor, dateToLabel12, toDateIso, msToHM } = require('./strategies');

const CONTAINER = 'fasts';

/**
 * One record per fasting session — the app's only real event log. A session
 * snapshots the strategy and target it was started under, so editing the plan
 * later never rewrites what history says was achieved.
 *
 * Everything here writes to the same container, so writes are sequenced with
 * plain `await` and never `Promise.all` — the file provider rewrites the whole
 * container per write, and a concurrent pair would clobber each other.
 */
function createFastsService({ store, plan, versionedCache, activity }) {
  async function list() {
    const all = await store.list(CONTAINER);
    return all.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
  }

  async function active() {
    const all = await list();
    return all.find((fast) => fast.status === 'active') || null;
  }

  /** A session whose start time hasn't arrived yet — scheduled, but not running. */
  function isScheduled(fast, now = Date.now()) {
    return Boolean(fast) && new Date(fast.startedAt).getTime() > now;
  }

  async function completed(limit = 20) {
    const all = await list();
    return all.filter((fast) => fast.status === 'completed').slice(0, limit);
  }

  /**
   * Ends the running fast (if any) and opens a fresh session — a new session
   * always starts with an empty note log.
   *
   * `startedAt` defaults to now (the Dashboard's "Start fast" button), but the
   * Setup screen passes the date and time the user picked, which may be in the
   * future (a scheduled fast) or the past (backdating one already under way).
   */
  async function start(startedAt = new Date()) {
    const beginsAt = startedAt instanceof Date ? startedAt : new Date(startedAt);
    if (Number.isNaN(beginsAt.getTime())) throw new Error('Start date and time are not a valid moment');

    const running = await active();
    // A session that never began has nothing to log — discard it rather than
    // completing it, or replanning would push a 0-minute partial into History.
    if (running) await (isScheduled(running) ? cancel() : end());

    const currentPlan = await plan.get();
    const record = await store.create(CONTAINER, {
      strategy: currentPlan.strategy,
      targetMs: targetMsFor(currentPlan.strategy),
      startedAt: beginsAt.toISOString(),
      date: toDateIso(beginsAt),
      endedAt: null,
      achievedMs: 0,
      status: 'active',
      notes: []
    });
    await versionedCache.bump();
    const label = strategyFor(currentPlan.strategy).label;
    await activity.log(
      'fast',
      isScheduled(record)
        ? `Scheduled a ${label} fast for ${dateToLabel12(beginsAt)}`
        : `Started a ${label} fast`,
      { fastId: record.id, startedAt: record.startedAt }
    );
    return record;
  }

  /**
   * Drops a scheduled fast that hasn't begun. Deliberately a delete rather than
   * an `end()`: a session with zero elapsed time would land in History as a
   * partial day and break the streak, when in truth it never happened.
   */
  async function cancel() {
    const running = await active();
    if (!running) return null;
    if (!isScheduled(running)) {
      throw new Error('This fast has already begun — end it instead of cancelling');
    }
    await store.remove(CONTAINER, running.id);
    await versionedCache.bump();
    await activity.log('fast', 'Cancelled a scheduled fast', { fastId: running.id });
    return running;
  }

  /** Ending early still logs the session with whatever was achieved against its target. */
  async function end() {
    const running = await active();
    if (!running) return null;

    const endedAt = new Date();
    const achievedMs = Math.max(0, endedAt.getTime() - new Date(running.startedAt).getTime());
    const updated = await store.update(CONTAINER, running.id, {
      status: 'completed',
      endedAt: endedAt.toISOString(),
      achievedMs
    });
    await versionedCache.bump();
    await activity.log('fast', `Ended a fast after ${msToHM(achievedMs)}`, {
      fastId: running.id,
      achievedMs,
      targetMs: running.targetMs
    });
    return updated;
  }

  /** Appends a note to the running fast, timestamped with the current clock time in 12-hour format. */
  async function addNote(text) {
    const running = await active();
    if (!running) throw new Error('No fast is running — start one before logging a note');
    if (isScheduled(running)) throw new Error('This fast has not begun yet — notes start once it does');
    const trimmed = String(text || '').trim();
    if (!trimmed) throw new Error('Note cannot be empty');

    const now = new Date();
    const note = {
      id: crypto.randomUUID(),
      label: dateToLabel12(now),
      text: trimmed,
      createdAt: now.toISOString()
    };
    const updated = await store.update(CONTAINER, running.id, { notes: [...(running.notes || []), note] });
    await versionedCache.bump();
    return updated;
  }

  return { list, active, completed, isScheduled, start, cancel, end, addNote };
}

module.exports = { createFastsService, CONTAINER };
