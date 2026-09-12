/**
 * @fileoverview Me Intermittent Fast — entry point.
 * Boots the Express app assembled in backend/app.js (native JS backend,
 * JSON-file storage via me-platform-core, static frontend in
 * ./public — no React, no build step).
 */

'use strict';

const { createApp } = require('./backend/app');
const config = require('./backend/config');

const app = createApp();

app.listen(config.port, () => {
  console.log(`=======================================================`);
  console.log(`Me Intermitent Fast running on port http://localhost:${config.port}`);
  console.log(`=======================================================`);
});
