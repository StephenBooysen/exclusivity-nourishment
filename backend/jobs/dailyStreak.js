/**
 * @fileoverview Worker-thread activity dispatched by the scheduling service
 * (see backend/app.js). Runs once at boot and then every 24h, writing a dated
 * streak/completion snapshot so long-term progress survives past the rolling
 * four-week window the History screen can see.
 *
 * Worker threads get their own module registry, so this talks to storage
 * directly through the file dataservice provider rather than pulling in
 * the whole app (which is wired to a specific Express instance it can't see).
 */

'use strict';

const Dataservicefiles = require('me-platform-core/src/dataservice/providers/dataservicefiles');
const { computeCalendar, computeStreak, computeCompletion } = require('../services/historyService');

const STREAK_SNAPSHOT_CONTAINER = 'streak_snapshots';
const FASTS_CONTAINER = 'fasts';
const PLAN_CONTAINER = 'fasting_plan';

async function run(data) {
  const dataDir = data && data.dataDir;
  const provider = new Dataservicefiles({ dataDir });

  const fasts = await provider.find(FASTS_CONTAINER, '');
  const plan = (await provider.find(PLAN_CONTAINER, ''))[0] || null;

  const cells = computeCalendar(fasts, plan, {});
  const today = new Date().toISOString().slice(0, 10);
  const payload = {
    date: today,
    streak: computeStreak(cells),
    completionRate: computeCompletion(cells),
    completedFasts: fasts.filter((fast) => fast.status === 'completed').length,
    strategy: plan ? plan.strategy : null
  };

  const existing = (await provider.find(STREAK_SNAPSHOT_CONTAINER, '')).find((s) => s.date === today);
  if (existing) {
    await provider.update(STREAK_SNAPSHOT_CONTAINER, existing.id, { ...existing, ...payload });
  } else {
    const id = await provider.add(STREAK_SNAPSHOT_CONTAINER, payload);
    await provider.update(STREAK_SNAPSHOT_CONTAINER, id, { ...payload, id });
  }

  return { message: 'daily streak snapshot recorded', ...payload };
}

module.exports = { run };
