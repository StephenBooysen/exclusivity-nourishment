'use strict';

const path = require('node:path');
const config = require('../config');

let platform = null;

/**
 * Initializes the digital-technologies-core service registry once per
 * process and returns the handful of services this app depends on. The
 * registry resolves cross-service dependencies (e.g. scheduling -> working)
 * automatically, so callers only need the top-level services they use.
 * @param {import('express').Express} app
 */
function initPlatform(app) {
  if (platform) return platform;

  // me-platform-core's entry point exports an already-constructed ServiceRegistry
  // instance, not a namespace object — there is no `.serviceRegistry` to reach for.
  const serviceRegistry = require('me-platform-core');
  const EventEmitter = require('node:events');
  const eventEmitter = new EventEmitter();

  serviceRegistry.initialize(app, eventEmitter, {
    baseUrl: '/platform-core',
    name: 'Me Intermittent Fast',
    logDir: config.logDir,
    dataDir: config.dataDir,
    cacheDir: path.join(config.rootDir, '.application', 'caching'),
    activitiesFolder: config.activitiesFolder,
    security: {
      apiKeyAuth: { requireApiKey: false, apiKeys: [] },
      servicesAuth: { requireLogin: false }
    }
  });

  const logger = serviceRegistry.logger('file');
  const cache = serviceRegistry.cache();
  const dataService = serviceRegistry.dataService('file');
  const queue = serviceRegistry.queue();
  const scheduler = serviceRegistry.scheduling();

  platform = { registry: serviceRegistry, eventEmitter, logger, cache, dataService, queue, scheduler };
  return platform;
}

/** Returns the already-initialized platform bundle; throws if called too early. */
function getPlatform() {
  if (!platform) {
    throw new Error('Platform not initialized — call initPlatform(app) first');
  }
  return platform;
}

module.exports = { initPlatform, getPlatform };
