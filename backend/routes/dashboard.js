'use strict';

const express = require('express');
const { asyncHandler } = require('./asyncHandler');

function dashboardRouter({ dashboard }) {
  const router = express.Router();

  router.get('/', asyncHandler(async (req, res) => {
    res.json(await dashboard.get());
  }));

  return router;
}

module.exports = { dashboardRouter };
