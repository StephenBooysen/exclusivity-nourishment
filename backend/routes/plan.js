'use strict';

const express = require('express');
const { asyncHandler } = require('./asyncHandler');

function planRouter({ plan, fasts }) {
  const router = express.Router();

  router.get('/', asyncHandler(async (req, res) => {
    res.json(await plan.get());
  }));

  router.put('/', asyncHandler(async (req, res) => {
    res.json(await plan.update(req.body));
  }));

  /**
   * "Start fasting plan" on the Setup screen: commit the settings, restart the
   * plan clock, and open the first fast in one call. The two writes hit
   * different containers but are still sequenced so the new fast can never
   * snapshot the previous strategy.
   *
   * The fast begins at `planStartedAt` — the date and time the user picked —
   * read back off the saved plan rather than recomputed, so the two agree even
   * if the request straddles a clock tick. A future pick leaves the fast
   * scheduled rather than running.
   */
  router.post('/start', asyncHandler(async (req, res) => {
    const updated = await plan.start(req.body);
    const fast = await fasts.start(new Date(updated.planStartedAt));
    res.status(201).json({ plan: updated, activeFast: fast });
  }));

  return router;
}

module.exports = { planRouter };
