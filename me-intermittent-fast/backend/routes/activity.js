'use strict';

const express = require('express');
const { asyncHandler } = require('./asyncHandler');

function activityRouter({ activity }) {
  const router = express.Router();

  router.get('/', asyncHandler(async (req, res) => {
    res.json(await activity.recent(Number(req.query.limit) || 20));
  }));

  return router;
}

module.exports = { activityRouter };
