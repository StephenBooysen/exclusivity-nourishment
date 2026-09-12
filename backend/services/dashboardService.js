'use strict';

const {
  strategyFor,
  targetMsFor,
  totalDaysFor,
  planDayNumber,
  planTagLabel,
  eatingWindow,
  dateToLabel12
} = require('./strategies');

/**
 * Everything the Dashboard screen needs in one read: the plan, the running
 * session, and the labels derived from them. Elapsed time, percentage, the
 * remaining countdown and the stage label are deliberately *not* here — the
 * frontend recomputes those on every tick from `activeFast.startedAt` and
 * `targetMs`, so the ring keeps moving without polling the server.
 *
 * Unlike History this is not cached: it changes with the clock, not with writes.
 */
function createDashboardService({ plan, fasts, settings }) {
  async function get() {
    // Three different containers, so these reads can safely overlap.
    const [currentPlan, activeFast, appSettings] = await Promise.all([
      plan.get(),
      fasts.active(),
      settings.get()
    ]);

    const strategy = strategyFor(currentPlan.strategy);
    const window = eatingWindow(currentPlan);
    const now = new Date();
    const scheduled = fasts.isScheduled(activeFast, now.getTime());

    // A session keeps the moment it was started (or scheduled) for, which need
    // not be the plan's start time — the Dashboard's "Start fast" button opens
    // one on the spot. Derive the window from the session so the two tiles
    // can't contradict each other; fall back to the plan's clock while idle.
    const eatingOpensLabel = activeFast
      ? dateToLabel12(new Date(activeFast.startedAt).getTime() + activeFast.targetMs)
      : window.opensLabel;

    return {
      plan: currentPlan,
      activeFast,
      scheduled,
      profile: { name: appSettings.profileName, email: appSettings.profileEmail },
      strategy: { key: strategy.key, label: strategy.label, hours: strategy.hours, blurb: strategy.blurb },
      // The running session keeps the target it started under; an idle dashboard previews the plan's.
      targetMs: activeFast ? activeFast.targetMs : targetMsFor(currentPlan.strategy),
      dayNumber: planDayNumber(currentPlan, now),
      totalDays: totalDaysFor(currentPlan.planLength),
      tagLabel: planTagLabel(currentPlan, now),
      startedAtLabel: activeFast ? dateToLabel12(activeFast.startedAt) : '—',
      // "Started 2:00 PM" would be a lie about a fast that hasn't begun.
      startedAtTileLabel: scheduled ? 'Starts' : 'Started',
      eatingOpensLabel,
      eatingClosesLabel: window.closesLabel,
      generatedAt: now.toISOString()
    };
  }

  return { get };
}

module.exports = { createDashboardService };
