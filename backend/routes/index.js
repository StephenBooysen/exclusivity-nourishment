'use strict';

const express = require('express');

const { planRouter } = require('./plan');
const { fastsRouter } = require('./fasts');
const { historyRouter } = require('./history');
const { dashboardRouter } = require('./dashboard');
const { settingsRouter } = require('./settings');
const { activityRouter } = require('./activity');

function buildApiRouter(services) {
  const router = express.Router();

  router.use('/plan', planRouter(services));
  router.use('/fasts', fastsRouter(services));
  router.use('/history', historyRouter(services));
  router.use('/dashboard', dashboardRouter(services));
  router.use('/settings', settingsRouter(services));
  router.use('/activity', activityRouter(services));

  router.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
    services.logger.error(`[api] ${req.method} ${req.originalUrl} — ${err.message}`);
    res.status(400).json({ error: err.message });
  });

  return router;
}

module.exports = { buildApiRouter };
