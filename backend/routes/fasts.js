'use strict';

const express = require('express');
const { asyncHandler } = require('./asyncHandler');

function fastsRouter({ fasts }) {
  const router = express.Router();

  router.get('/', asyncHandler(async (req, res) => {
    res.json(await fasts.completed(Number(req.query.limit) || 20));
  }));

  router.get('/active', asyncHandler(async (req, res) => {
    res.json(await fasts.active());
  }));

  router.post('/start', asyncHandler(async (req, res) => {
    res.status(201).json(await fasts.start());
  }));

  router.post('/end', asyncHandler(async (req, res) => {
    const ended = await fasts.end();
    if (!ended) return res.status(404).json({ error: 'No fast is running' });
    res.json(ended);
  }));

  /** Drops a scheduled fast that hasn't begun. Rejects one already under way — that's `/end`. */
  router.post('/cancel', asyncHandler(async (req, res) => {
    const cancelled = await fasts.cancel();
    if (!cancelled) return res.status(404).json({ error: 'No fast is scheduled' });
    res.json(cancelled);
  }));

  router.post('/notes', asyncHandler(async (req, res) => {
    res.status(201).json(await fasts.addNote(req.body.text));
  }));

  return router;
}

module.exports = { fastsRouter };
