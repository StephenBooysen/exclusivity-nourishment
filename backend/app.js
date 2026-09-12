'use strict';

const express = require('express');
const path = require('node:path');

const config = require('./config');
const { initPlatform } = require('./services/platform');
const { createStore } = require('./services/store');
const { createVersionedCache } = require('./services/cacheVersion');
const { createActivityService } = require('./services/activityService');
const { createPlanService } = require('./services/planService');
const { createFastsService } = require('./services/fastsService');
const { createHistoryService } = require('./services/historyService');
const { createSettingsService } = require('./services/settingsService');
const { createDashboardService } = require('./services/dashboardService');
const { buildApiRouter } = require('./routes');

/** Builds the Express app: platform-core wiring, domain services, API routes, static frontend. */
function createApp() {
  const app = express();
  app.use(express.json());

  const platform = initPlatform(app);
  const { logger, cache, dataService, scheduler } = platform;

  const store = createStore(dataService);
  const versionedCache = createVersionedCache(cache);
  const activity = createActivityService({ store, queue: platform.queue, logger });

  const plan = createPlanService({ store, versionedCache, activity });
  const fasts = createFastsService({ store, plan, versionedCache, activity });
  const history = createHistoryService({ fasts, plan, versionedCache });
  const settings = createSettingsService({ store, versionedCache });
  const dashboard = createDashboardService({ plan, fasts, settings });

  const services = {
    logger, cache, dataService, store, versionedCache, activity,
    plan, fasts, history, settings, dashboard
  };

  activity.startDrainLoop();

  scheduler.start(
    'daily-streak-snapshot',
    'dailyStreak.js',
    { dataDir: config.dataDir },
    24 * 60 * 60,
    (status, result) => {
      logger.info(`[scheduler] daily-streak-snapshot ${status}`, result);
    }
  ).catch((err) => logger.error('[scheduler] failed to start daily streak job', err.message));

  app.use('/api', buildApiRouter(services));
  app.use(express.static(config.publicDir));
  app.get('/', (req, res) => {
    res.sendFile(path.join(config.publicDir, 'index.html'));
  });

  return app;
}

module.exports = { createApp };
