'use strict';

const VERSION_KEY = 'intermittent-fast:data-version';

/**
 * Generation-counter cache: every write bumps a shared version number, and
 * every cached computation keys itself off that version. No pattern-delete
 * needed from the underlying cache (put/get/delete only) — a bump silently
 * orphans the previous generation's keys instead of walking them.
 */
function createVersionedCache(cache) {
  async function currentVersion() {
    const value = await cache.get(VERSION_KEY);
    return value || 0;
  }

  async function bump() {
    const next = (await currentVersion()) + 1;
    await cache.put(VERSION_KEY, next);
    return next;
  }

  async function remember(keyPrefix, compute) {
    const version = await currentVersion();
    const key = `${keyPrefix}:v${version}`;
    const cached = await cache.get(key);
    if (cached !== undefined) return cached;
    const value = await compute();
    await cache.put(key, value);
    return value;
  }

  return { bump, currentVersion, remember };
}

module.exports = { createVersionedCache };
