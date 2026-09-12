'use strict';

const express = require('express');
const { asyncHandler } = require('./asyncHandler');

function historyRouter({ history }) {
  const router = express.Router();

  router.get('/', asyncHandler(async (req, res) => {
    res.json(await history.get());
  }));

  return router;
}

module.exports = { historyRouter };
