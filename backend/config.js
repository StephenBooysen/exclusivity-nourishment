'use strict';

const path = require('node:path');

const ROOT_DIR = path.join(__dirname, '..');
const APPLICATION_DIR = path.join(ROOT_DIR, '.application');

module.exports = {
  port: process.env.PORT || 9301,
  rootDir: ROOT_DIR,
  publicDir: path.join(ROOT_DIR, 'public'),
  logDir: path.join(APPLICATION_DIR, 'logs'),
  dataDir: path.join(APPLICATION_DIR, 'data'),
  activitiesFolder: path.join(__dirname, 'jobs'),
  locale: 'en-ZA',
  defaults: {
    strategy: '16:8',
    startTime: '20:00',
    planLength: '1 month',
    fastingDays: { Mon: true, Tue: false, Wed: false, Thu: true, Fri: false, Sat: false, Sun: false },
    // The History screen shows exactly four weeks; the completion rate is scored over the same window.
    calendarDays: 28
  }
};
