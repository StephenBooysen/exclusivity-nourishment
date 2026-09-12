'use strict';

const express = require('express');
const { asyncHandler } = require('./asyncHandler');

function settingsRouter({ settings }) {
  const router = express.Router();

  router.get('/', asyncHandler(async (req, res) => {
    res.json(await settings.get());
  }));

  router.put('/', asyncHandler(async (req, res) => {
    res.json(await settings.update(req.body));
  }));

  return router;
}

module.exports = { settingsRouter };
