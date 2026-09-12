'use strict';

const QUEUE_NAME = 'intermittent-fast:activity';
const CONTAINER = 'activity_log';

/**
 * Write-behind audit trail. Writers call `log()` which only enqueues — the
 * drain loop persists to JSON on its own cadence, so starting or ending a
 * fast never waits on an extra disk write to finish the request.
 */
function createActivityService({ store, queue, logger }) {
  async function log(type, message, meta = {}) {
    await queue.enqueue(QUEUE_NAME, {
      type,
      message,
      meta,
      createdAt: new Date().toISOString()
    });
  }

  async function drainOnce() {
    const pending = await queue.size(QUEUE_NAME);
    for (let i = 0; i < pending; i += 1) {
      const item = await queue.dequeue(QUEUE_NAME);
      if (!item) break;
      await store.create(CONTAINER, item);
      logger.info(`[activity] ${item.type}: ${item.message}`);
    }
  }

  function startDrainLoop(intervalMs = 2000) {
    const timer = setInterval(() => {
      drainOnce().catch((err) => logger.error('[activity] drain failed', err.message));
    }, intervalMs);
    timer.unref?.();
    return timer;
  }

  async function recent(limit = 20) {
    const all = await store.list(CONTAINER);
    return all
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit);
  }

  return { log, drainOnce, startDrainLoop, recent };
}

module.exports = { createActivityService };
